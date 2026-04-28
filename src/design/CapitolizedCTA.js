import React from 'react'
import { useState } from 'react'
import { css } from '@emotion/react'

import Image from 'next/image';
import wideCapitolizedLogo from "../../public/Capitolized400x147.webp"

const style = css`
    background: #191919;
    color: white;
    padding: 1em;
    margin-top: 2em;
    margin-bottom: 2em;

    .row {
        
        display: flex;
        flex-wrap: wrap;

        .img-col {
            position: relative;
            flex: 1 1 300px;
            margin-bottom: 0.5em;
            min-height: 100px;

            a:hover {
                opacity: 0.8
            }
        }
        .words-col {
            flex: 1 1 300px;
            padding: 0 1em;

            .message {
                font-size: 1.2em;
                font-weight: bold;
                margin-bottom: 0.5em;
            }
            .message-2 {
                font-size: 1.1em;
                margin-bottom: 0.5em;
            }
            
        }
    }
    
    .message-below {
        font-size: 0.9em;
        margin-top: 0.5em;
        font-style: italic;
    }

    .signup {
        margin: 0.5em 0;
    }

    .signupGroup {
        display: flex;        
    }

    .textInput {
        flex: 1 1 40rem;
        margin: -1px;
        height: 2.5rem;
        padding-left: 0.5rem;
    }
    .submitButton {
        flex: 0 1 10rem;
        margin: -1px;
        background-color: #F85028;
        border: 1px solid #F85028;
        color: #fff;
        /* height: 1.2em; */
    }

    .submitButton:hover{
        background-color: #BA892D;
        border: 1px solid #BA892D;
        /* color: #222; */

    }
`

// Temporary link approach
export default function CapitolizedCTA() {
    return <div css={style}>
        <div className="row">
            <div className="img-col">
                <a href="https://montanafreepress.org/newsletters-sign-up/">
                    <Image
                        src={wideCapitolizedLogo}
                        alt="Capitolized newsletter"
                        width={400}
                        height={147}
                        style={{width: '100%', height: 'auto'}}
                    />
                </a>
            </div>
            <div className="words-col">
                {/* <div className="message">Sign up for CAPITOLIZED</div> */}
                <div className="message-2">Expert reporting and insight from the Montana Capitol, emailed Thursdays.</div>
                <br />
                <div className="signup">
                    👉 <a href="https://montanafreepress.org/newsletters-sign-up/"> SIGN UP HERE</a>
                </div >
            </div>
        </div>
    </div >
}