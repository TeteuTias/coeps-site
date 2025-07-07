import Fireworks from "react-canvas-confetti/dist/presets/fireworks";

function FireWork({ activate }) {
    return (
        <>
            {
                activate ?
                    <Fireworks autorun={{ speed: 2 }} /> : ""
            }
        </>
    )
}

export default FireWork;