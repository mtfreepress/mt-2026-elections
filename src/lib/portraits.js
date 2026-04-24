import fs from 'fs'
import path from 'path'

let slugSet = null

function getPortraitSlugSet() {
    if (!slugSet) {
        const dir = path.join(process.cwd(), 'public', 'portraits')
        slugSet = new Set(
            fs.readdirSync(dir)
                .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
                .map(f => path.basename(f, path.extname(f)))
        )
    }
    return slugSet
}

export function hasPortrait(slug) {
    return getPortraitSlugSet().has(slug)
}
