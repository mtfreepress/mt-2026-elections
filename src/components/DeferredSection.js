import React, { useEffect, useRef, useState } from 'react'
import { css } from '@emotion/react'

const skeletonStyle = css`
    width: 100%;
    border: 1px solid var(--gray1);
    border-radius: 6px;
    background: linear-gradient(90deg, #f6f3ee 0%, #ece4d8 40%, #f6f3ee 80%);
    background-size: 200% 100%;
    animation: sectionShimmer 1.25s ease-in-out infinite;

    @keyframes sectionShimmer {
        0% {
            background-position: 200% 0;
        }
        100% {
            background-position: -200% 0;
        }
    }
`

function SectionSkeleton({ minHeight }) {
    return <div css={skeletonStyle} style={{ minHeight }} aria-hidden="true" />
}

export default function DeferredSection({
    children,
    minHeight = 260,
    idleTimeout = 1400,
    rootMargin = '320px 0px',
    className,
}) {
    const [revealed, setRevealed] = useState(false)
    const containerRef = useRef(null)

    useEffect(() => {
        if (revealed) return

        let observer = null
        let timeoutId = null
        let idleId = null

        const reveal = () => setRevealed(true)

        if (typeof window !== 'undefined') {
            if ('IntersectionObserver' in window && containerRef.current) {
                observer = new window.IntersectionObserver(
                    entries => {
                        const visible = entries.some(entry => entry.isIntersecting)
                        if (visible) {
                            reveal()
                            observer.disconnect()
                        }
                    },
                    { rootMargin }
                )
                observer.observe(containerRef.current)
            }

            if ('requestIdleCallback' in window) {
                idleId = window.requestIdleCallback(reveal, { timeout: idleTimeout })
            } else {
                timeoutId = window.setTimeout(reveal, idleTimeout)
            }
        }

        return () => {
            if (observer) observer.disconnect()
            if (idleId && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
                window.cancelIdleCallback(idleId)
            }
            if (timeoutId) window.clearTimeout(timeoutId)
        }
    }, [revealed, idleTimeout, rootMargin])

    return (
        <div ref={containerRef} className={className}>
            {revealed ? children : <SectionSkeleton minHeight={minHeight} />}
        </div>
    )
}
