import { HD_TO_PSC } from './../data/hd-to-psc'
import { getCorrespondingSenateDistrictNumber } from './utils'

// Montana moved these services from gisservicemt.gov to gisservice.mt.gov in
// June 2026. The replacement ArcGIS server supports browser CORS, so requests
// can go directly to the source instead of depending on the legacy AWS proxy.
const ARCGIS_BASE_URL = 'https://gisservice.mt.gov/arcgis/rest/services'
const BOUNDARIES_BASE_URL = `${ARCGIS_BASE_URL}/msdi_administrative_boundaries_map_v1/MapServer`
const ADDRESS_LOCATOR_BASE_URL = `${ARCGIS_BASE_URL}/msdi_address_locator_geocode_v1/GeocodeServer`
const STATE_HOUSE_DISTRICT_API_URL = `${BOUNDARIES_BASE_URL}/63/query`
const CONGRESSIONAL_DISTRICT_API_URL = `${BOUNDARIES_BASE_URL}/34/query`
const GEOCODE_API_URL = `${ADDRESS_LOCATOR_BASE_URL}/findAddressCandidates`
const SUGGEST_API_URL = `${ADDRESS_LOCATOR_BASE_URL}/suggest`

// Restrict geocoding to Montana at the API layer for better relevance and fewer results.
const MONTANA_SEARCH_EXTENT = JSON.stringify({
    xmin: -116.3,
    ymin: 44.1,
    xmax: -104.0,
    ymax: 49.3,
    spatialReference: { wkid: 4326 }
})

const MONTANA_GEOCODE_DEFAULTS = {
    sourceCountry: 'USA',
    searchExtent: MONTANA_SEARCH_EXTENT,
}

export default class DistrictFinder {

    async matchAddressToDistricts(address, callback, fallback) {
        try {
            const geocodeResponse = await this.geocode(address)
            const place = this.pickAddress(geocodeResponse.candidates)
            if (!place || !place.location) {
                fallback(null)
                return
            }

            const matchedAddress = place.address
            const [houseDistrictResponse, congressionalDistrictResponse] = await Promise.all([
                this.getDistrict({
                    apiUrl: STATE_HOUSE_DISTRICT_API_URL,
                    coords: place.location,
                    fields: 'District'
                }),
                this.getDistrict({
                    apiUrl: CONGRESSIONAL_DISTRICT_API_URL,
                    coords: place.location,
                    fields: 'DistrictNumber'
                })
            ])

            const hd = houseDistrictResponse?.features?.[0]?.attributes?.District
            const usHouse = congressionalDistrictResponse?.features?.[0]?.attributes?.DistrictNumber
            if (!hd || !usHouse) {
                fallback(null)
                return
            }

            // State senate and PSC districts derived from state house disrict
            const sd = getCorrespondingSenateDistrictNumber(hd)
            const psc = HD_TO_PSC[hd]

            callback({
                matchedAddress,
                mtHouse: `HD-${hd}`,
                mtSenate: `SD-${sd}`,
                psc,
                usHouse: `us-house-${usHouse}`,
            })
        } catch (error) {
            console.error('District lookup failed:', error)
            fallback(error)
        }
    }

    async geocode(address, options = {}) {
        const { maxLocations, signal } = options
        const payload = {
            SingleLine: address,
            f: 'pjson',
            outSR: '102100',
            ...MONTANA_GEOCODE_DEFAULTS,
            ...(maxLocations ? { maxLocations } : {}),
        }
        const url = this.makeQuery(GEOCODE_API_URL, payload)
        return this.fetchArcGisJson(url, { signal })
    }

    async suggestAddresses(address, options = {}) {
        const query = (address || '').trim()
        if (!query) return []

        const { maxLocations = 6, signal } = options
        const payload = {
            text: query,
            f: 'pjson',
            maxSuggestions: maxLocations,
            category: 'Address',
            countryCode: 'USA',
            searchExtent: MONTANA_SEARCH_EXTENT,
        }
        const suggestResponse = await this.fetchArcGisJson(
            this.makeQuery(SUGGEST_API_URL, payload),
            { signal }
        )
        const suggestions = suggestResponse?.suggestions || []

        return suggestions
            .filter(suggestion => !!suggestion && !!suggestion.text)
            .map(suggestion => suggestion.text)
    }

    async getDistrict({ apiUrl, coords, fields }) {
        const payload = {
            f: 'pjson',
            where: '',
            returnGeometry: 'false',
            spatialRel: 'esriSpatialRelIntersects',
            geometry: `{"x":${coords.x},"y":${coords.y},"spatialReference":{"wkid":102100,"latestWkid":3857}}`,
            geometryType: 'esriGeometryPoint',
            inSR: '102100',
            outFields: fields,
        }
        const url = this.makeQuery(apiUrl, payload)
        return this.fetchArcGisJson(url)
    }

    async fetchArcGisJson(url, options = {}) {
        const response = await fetch(url, options)
        if (!response.ok) {
            throw new Error(`Montana GIS request failed with HTTP ${response.status}`)
        }

        const data = await response.json()
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Montana GIS returned an unexpected response')
        }
        if (data.error) {
            throw new Error(data.error.message || 'Montana GIS returned an error')
        }
        return data
    }


    makeQuery = (url, params) => {
        let string = url + '?'
        for (let key in params) {
            // Encode both key and value
            string = string + `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}&`
        }
        // Remove trailing '&' if present
        return string.slice(0, -1)
    }

    pickAddress = (locations) => {
        if (locations === undefined) return null
        return locations[0]
    }
}
