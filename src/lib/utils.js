import { format } from 'd3-format'
import { timeFormat } from 'd3-time-format'

export const urlize = str => str.toLowerCase().replaceAll(/\s/g, '-')

export const numberFormat = format(',.0f')
export const percentFormat = format('.1%')

export const formatDate = timeFormat('%b %-d, %Y')
export const formatTimeLong = timeFormat('%-I:%M %p %b %-d, %Y')


export const pluralize = (text, value) => value === 1 ? text : `${text}s`


export const getDistrictNumber = (key) => {
    return +key.replace('-', '').replace('SD', '').replace('HD', '')
}
export const getCorrespondingHouseDistrictNumbers = (sd) => {
    const number = getDistrictNumber(sd)
    return [number * 2 - 1, number * 2]
}

export const getCorrespondingSenateDistrictNumber = (hd) => {
    if (hd === null) return null
    const number = getDistrictNumber(hd)
    return Math.ceil(number / 2)
}

// Pre-built formatter instances — avoids reconstructing them on every call
const _fmt0f  = format('$,.0f')
const _fmt1s  = format('$,.1s')
const _fmt2s  = format('$,.2s')
const _fmt3s  = format('$,.3s')

export const dollarFormatResponsive = num => {
    const abs = Math.abs(num)
    if (abs < 1_000)         return _fmt0f(num)
    if (abs < 10_000)        return _fmt1s(num)
    if (abs < 100_000)       return _fmt2s(num)
    if (abs < 1_000_000)     return _fmt3s(num)
    if (abs < 10_000_000)    return _fmt2s(num)
    if (abs < 100_000_000)   return _fmt3s(num)
    return 'ERR'
}