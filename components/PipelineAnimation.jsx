'use client';

import { useEffect, useRef, useState } from 'react';

const SIZE = 36;  // cube size px (60 % reduction of 91 px)
const STEP = SIZE; // arm length in the 3-D cross

// 7 cubes forming a 3-D plus: centre + 6 arms (±X, ±Y, ±Z)
const CUBES = [
  { id: 0, color: 'cyan',   fx: 0,      fy: 0,      fz: 0     }, // centre
  { id: 1, color: 'orange', fx: 0,      fy: -STEP,  fz: 0     }, // top
  { id: 2, color: 'purple', fx: 0,      fy:  STEP,  fz: 0     }, // bottom
  { id: 3, color: 'cyan',   fx: -STEP,  fy: 0,      fz: 0     }, // left
  { id: 4, color: 'orange', fx:  STEP,  fy: 0,      fz: 0     }, // right
  { id: 5, color: 'purple', fx: 0,      fy: 0,      fz:  STEP }, // front
  { id: 6, color: 'cyan',   fx: 0,      fy: 0,      fz: -STEP }, // back
];

// Initial scatter positions relative to the group anchor (right: 15 %)
// Negative X spreads cubes to the left across the scene
const SCATTER = [
  { sx: -310, sy: -60  },
  { sx: -140, sy: -95  },
  { sx:  -65, sy:  70  },
  { sx: -260, sy:  45  },
  { sx: -400, sy: -20  },
  { sx: -180, sy:  88  },
  { sx:  -90, sy: -80  },
];

// Different spin durations per cube for visual variety
const DURATIONS = ['6.4s', '5.7s', '7.1s', '5.9s', '6.8s', '7.4s', '5.5s'];

export default function PipelineAnimation() {
  const [transitionReady, setTransitionReady] = useState(false);
  const [assembled,       setAssembled]       = useState(false);
  const [glowing,         setGlowing]         = useState(false);
  const flags = useRef({ tr: false, as: false, gl: false });

  useEffect(() => {
    let raf;
    let t0 = null;

    const tick = (now) => {
      if (t0 === null) t0 = now;
      const elapsed = now - t0;

      if (elapsed >= 2500 && !flags.current.tr) {
        flags.current.tr = true;
        setTransitionReady(true);
        // Double RAF: transition style must be committed before the transform changes
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            flags.current.as = true;
            setAssembled(true);
          })
        );
      }

      if (elapsed >= 4200 && !flags.current.gl) {
        flags.current.gl = true;
        setGlowing(true);
        return; // stop the loop
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pa-wrap" aria-hidden="true">
      <div className="pa-scene">
        <div className={`pa-group${glowing ? ' pa-group--glowing' : ''}`}>
          {CUBES.map((cube, i) => (
            <div
              key={cube.id}
              className={`pa-cube-wrap pa-cube--${cube.color}${glowing ? ' pa-cube--glow' : ''}`}
              style={{
                transform: assembled
                  ? `translate3d(${cube.fx}px, ${cube.fy}px, ${cube.fz}px)`
                  : `translate3d(${SCATTER[i].sx}px, ${SCATTER[i].sy}px, 0px)`,
                transition: transitionReady
                  ? 'transform 1.5s cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'none',
              }}
            >
              <div
                className={`pa-cube-inner${assembled ? '' : ' pa-cube-inner--floating'}`}
                style={!assembled ? {
                  animationName:     `pa-spin-${cube.id}`,
                  animationDuration: DURATIONS[i],
                } : {}}
              >
                <div className="pa-face pa-face-front" />
                <div className="pa-face pa-face-back" />
                <div className="pa-face pa-face-right" />
                <div className="pa-face pa-face-left" />
                <div className="pa-face pa-face-top" />
                <div className="pa-face pa-face-bottom" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
