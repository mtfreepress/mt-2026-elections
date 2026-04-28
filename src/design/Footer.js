import { css } from '@emotion/react'
import Image from 'next/image'

import { footerMenus, footerLogoUrl } from '../config'

import mtfpLogo from '../../public/mtfp-logo.webp'

const footerStyle = css`

    font-size: 13px;

    display: block;

    font-family: futura-pt, Arial, Helvetica, sans-serif;
    background: #171818;
    color: #fff;

    @media (min-width: 782px) {
        padding-top: 2em;
    }
`
const footerWrapperStyle = css`
    max-width: 1200px;
    margin: auto;
`
const footerColumnsStyle = css`
    text-transform: uppercase;
    overflow-wrap: break-word;

    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;

    margin-left: clamp(12px, 4vw, 39px);
    margin-right: clamp(12px, 4vw, 39px);
    max-width: none;
`

const menuStyle = css`
    margin-right: 40px;

    @media (max-width: 700px) {
        margin-right: 0;
        width: 100%;
    }
`

const menuListStyle = css`
    list-style-image: none;
    list-style-type: none;
    list-style-position: outside;
    padding-inline-start: 0px;
    font-weight: 400px;
    letter-spacing: 2px;
    line-height: 20.48px;

    li {
        margin-bottom: 12.8px;
    }

    a {
        color: #fff;
        text-decoration: none;
    }
`

const footerInfoStyle = css`
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;

    padding-bottom: 20px;
    margin-left: clamp(12px, 4vw, 39px);
    margin-right: clamp(12px, 4vw, 39px);
    color: #aa986a;

    @media (max-width: 700px) {
        align-items: flex-start;
        gap: 0.75em;
    }

    a {
        color: #aa986a;
        text-decoration: none;
    }
`
const footerImgStyle = css`
    max-width: 100%;
    height: auto;
`

const Footer = (props) => {
    const menusRendered = footerMenus.map((menu, i) => {
        const itemsRendered = menu.items.map((item, i) => <li key={String(i)}><a href={item.url}>{item.label}</a></li>)
        return <section css={menuStyle} key={String(i)}>
            <h2>{menu.label}</h2>
            <ul css={menuListStyle}>{itemsRendered}</ul>
        </section>
    })

    return <footer css={footerStyle}>
        <div css={footerWrapperStyle}>
            <div css={footerColumnsStyle}>
                {menusRendered}
            </div>

            <div css={footerInfoStyle}>
                <span>© {new Date().getFullYear()} Montana Free Press. </span>
                <a href="https://montanafreepress.org/about-mtfp/privacy-policy/">Privacy Policy</a>
                <Image alt="MTFP logo" width={121} css={footerImgStyle} src={mtfpLogo} />
            </div>
        </div>

    </footer>
}

export default Footer