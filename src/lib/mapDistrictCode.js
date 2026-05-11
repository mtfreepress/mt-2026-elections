// TODO: Decide if we want this here or in AddressLookup
export default function mapDistrictCode(districtCode) {
    if (!districtCode) return '';
    const mappings = {
        'us-house': number => `U.S. House District ${number} (${number === '1' ? 'West' : 'East'})`,
        'psc': 'Public Service Commission District',
        'HD': 'MT House District',
        'SD': 'MT Senate District'
    };
    const match = districtCode.match(/(us-house|psc|HD|SD)-(\d+)/);
    if (match) {
        const [, prefix, number] = match;
        return prefix === 'us-house'
            ? mappings[prefix](number)
            : `${mappings[prefix]} ${number}`;
    }
    return districtCode;
}
const selDistricts = {
    usHouse: null,
    psc: null,
    mtHouse: null,
    mtSenate: null,
    matchedAddress: null
};