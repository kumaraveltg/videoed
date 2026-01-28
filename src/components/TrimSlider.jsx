import Slider from "rc-slider";
import "rc-slider/assets/index.css";
import React from "react";

function TrimSlider({ duration, setTrim }) {
    if (duration == null) {
        return null;
    }
    return ( <div className="trim-slider-component" style={{ margin: "20px 0" }}>
        <h4>Trim Video</h4>
        <Slider 
            range
            min={0}
            max={Math.floor(duration)}  
            defaultValue={[0, Math.floor(duration)]}
            onAfterChange={(values) => setTrim({ start: values[0], end: values[1] })}
            marks={{
                0: "0s",    
                [Math.floor(duration)]: `${Math.floor(duration)}s`
            }}
        />
    </div>
    );
}
export default TrimSlider;
