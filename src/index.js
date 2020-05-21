import { render } from 'react-dom'
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useSprings, animated, to as interpolate, config, useTransition } from 'react-spring'
import { useDrag } from 'react-use-gesture'
import './styles.css'

const items = [
  { background: '#ffeed2', content: 'Hello', id: 1, title: 'Reimagine your life without any electronic product' },
  { background: '#a1c3d2', content: 'こんにちは', id: 2, title: 'Make your best to take challenge in your work' },
  { background: '#3869a8', content: 'Bonjour', id: 3, title: 'React is good but not for high frequency changing data' },
  {
    background: '#ffccd2',
    content: 'Hallo',
    id: 4,
    title: 'Life is not easy but you should try to overcome it'
  },
  {
    background: '#fec864',
    content: 'Olá',
    id: 5,
    title: 'State management and orchestration of animation is difficult sometimes'
  }
]

const log = console.log.bind(console)

console.log = (...args) => {
  if (process.NODE_ENV === 'production') {
    return
  }
  log(new Date().toLocaleString(), ...args)
}

const defaultOptions = {
  beforeNext: () => true,
  onNext: () => {},
  beforePrev: () => true,
  onPrev: () => {},
  loop: false,
  beforeLoop: () => true,
  onLoop: () => {},
  auto: true,
  autoInterval: 5000,
  count: 0
}

const useSlide = (options = {}) => {
  const [idx, setIdx] = useState(0)
  const rafId = useRef()
  const prevTime = useRef(0)
  const playing = useRef(false)
  const locking = useRef(null)
  const pausing = useRef(false)
  const navigateRef = useRef()
  const settings = useRef()
  settings.current = Object.assign({}, defaultOptions, options)

  const navigate = useCallback(
    async (dir, autoTrigger) => {
      const { count, onNext, onLoop, loop, beforeNext, beforeLoop, beforePrev, onPrev } = settings.current
      if (count <= 0 || dir === 0) return
      let newIdx = dir > 0 ? idx + 1 : idx - 1
      let type = dir > 0 ? 'next' : 'prev'
      if (newIdx >= count) {
        if (!loop) return
        newIdx = 0
        type = 'loop'
      } else if (newIdx < 0) {
        if (!loop) return
        newIdx = count - 1
        type = 'loop'
      }
      console.log(`navigate new idx ${newIdx}, old idx ${idx}`)

      locking.current = newIdx
      try {
        const shouldUpdate =
          type === 'next'
            ? beforeNext(newIdx, idx, autoTrigger)
            : type === 'prev'
            ? beforePrev(newIdx, idx, autoTrigger)
            : beforeLoop(newIdx, idx, autoTrigger)
        if (shouldUpdate !== false) {
          setIdx(newIdx)
          // clear tick here because it is certain to do navigation, that means auto play is cancelled
          resetProgressTicker()
          await Promise.resolve(
            type === 'next'
              ? onNext(newIdx, idx, autoTrigger)
              : type === 'prev'
              ? onPrev(newIdx, idx, autoTrigger)
              : onLoop(newIdx, idx, autoTrigger)
          )
        }
      } finally {
        // unlock before auto start, also check if other operations has overwritten this locking key
        // if so, skip unlock process to give control to other operations
        if (locking.current === newIdx) {
          locking.current = null
        }
        startAutoPlay()
      }
    },
    [idx]
  )

  navigateRef.current = navigate

  const resetProgressTicker = useCallback(() => {
    rafId.current && cancelAnimationFrame(rafId.current)
    playing.current = false
    const { onProgress } = settings.current
    onProgress && onProgress(0)
  }, [])

  const startAutoPlay = useCallback(() => {
    const { autoInterval, auto, count, onProgress } = settings.current
    // use playing to prevent multiple calls to trigger multiple ticking
    // prevent auto play when `next` or `prev` task has not finished, that is `locking`
    if (!auto || count <= 0 || playing.current || locking.current != null || pausing.current) return
    playing.current = true
    prevTime.current = Date.now()
    const tick = () => {
      const elapsedTime = Date.now() - prevTime.current
      const newProgress = Math.min(100, elapsedTime / autoInterval)
      onProgress && onProgress(newProgress)
      if (elapsedTime < autoInterval) {
        rafId.current = requestAnimationFrame(tick)
      } else {
        // stop auto play to make `next` working properly because `next` is not a sync op
        stopAutoPlay()
        navigateRef.current(1, true)
      }
    }
    rafId.current = requestAnimationFrame(tick)
  }, [])

  const stopAutoPlay = useCallback(() => {
    resetProgressTicker()
    playing.current = false
  }, [])

  const restartAutoPlay = useCallback(() => {
    pausing.current = false
    setIdx(0)
    resetProgressTicker()
    startAutoPlay()
  }, [])

  const reset = useCallback(() => {
    resetProgressTicker()
    prevTime.current = 0
    playing.current = false
    locking.current = null
    pausing.current = false
    setIdx(0)
  }, [])

  useEffect(() => {
    if (settings.current.auto) {
      startAutoPlay()
    } else {
      stopAutoPlay()
    }
  }, [settings.current.auto])

  const result = useMemo(() => {
    const r = {
      current: idx,
      restart: restartAutoPlay,
      reset,
      play: () => {
        pausing.current = false
        startAutoPlay()
      },
      pause: () => {
        pausing.current = true
        stopAutoPlay()
      },
      next: () => navigate(1, false),
      prev: () => navigate(-1, false)
    }

    Object.defineProperties(r, {
      total: {
        get: () => settings.current.count,
        enumerable: true,
        configurable: false
      },
      pausing: {
        get: () => pausing.current,
        enumerable: true,
        configurable: false
      }
    })

    return r
  }, [idx])
  return result
}

const to = (i) => ({ x: 0, y: 0, scale: i === 0 ? 1 : 0.95, rot: i === 0 ? 0 : -15 + Math.random() * 30, delay: i * 50 })

const from = (i) => ({ x: 200 + window.innerWidth, rot: 0, scale: 1, y: 0 })

const trans = (r, s) => `perspective(1500px) rotateX(5deg) rotateZ(${r}deg) scale(${s})`

const delay = (fn, time = 5000) =>
  new Promise((resolve) =>
    setTimeout(() => {
      resolve(fn())
    }, time)
  )

const useRerender = () => {
  const [_, set] = useState()
  return useCallback(() => set({}), [])
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const Slider = () => {
  const [slideItems, setSlideItems] = useState(items)
  const rerender = useRerender() // use rerender here to keep gone state up-to-date where rendering
  const gone = useMemo(() => new Set(), [])
  const [props, set] = useSprings(slideItems.length, (i) => ({ ...to(i), from: from(i) }))
  const progressRef = useRef()
  const [shuffling, setShuffling] = useState(false);

  const addGone = useCallback((i) => {
    gone.add(i);
    rerender();
  }, []);

  const deleteGone = useCallback((i) => {
    gone.delete(i)
    rerender()
  }, []);

  const clearGone = useCallback(() => {
    gone.clear();
    rerender();
  }, []);

  const { current, pause, play, next, prev, reset } = useSlide({
    count: slideItems.length,
    onNext: (newIdx, prevIdx) => {
      const hasGone = gone.has(prevIdx)
      if (!hasGone) {
        addGone(prevIdx)
      }
      // fly previous item only when it has not gone, for example, not triggered by dragging
      // make new item return to normal state that is no rotation
      return Promise.race([
        set((i) => {
          if (prevIdx === i && !hasGone) {
            const x = 200 + window.innerWidth
            return { x, rot: 0, scale: 1, config: { friction: 50, tension: 200 } }
          }
          if (newIdx === i) {
            return { rot: 0, scale: 1 }
          }
        }),
        delay(() => {}, 500)
      ])
    },
    onPrev: (newIdx, oldIdx) => {
      const hasGone = gone.has(newIdx)
      if (hasGone) {
        deleteGone(newIdx);
      }
      return Promise.race([
        set((i) => {
          // let previous item back, current item back to `to` state
          if (newIdx === i && hasGone) {
            return { x: 0, rot: 0, scale: 1, config: { friction: 50, tension: 300 } }
          }
          if (oldIdx === i) {
            return to(i)
          }
        }),
        delay(() => {}, 500)
      ])
    },
    onLoop: (newIdx, idx, autoTrigger) => {
      const wait = gone.size !== items.length ? 0 : 1000
      let t = Promise.resolve();
      if (!gone.has(idx) && !autoTrigger) {
        // fly it first
        addGone(idx);
        t = set(i => {
          if (i !== idx) return;
          const x = 200 + window.innerWidth
          return { x, rot: 0, scale: 1, config: { friction: 50, tension: 200 } }
        });
      }
      return t.then(() => delay(() => {
        delay(() => {
          clearGone();
        }, 500);
        return set((i) => to(i))
      }, wait));
    },
    loop: true,
    auto: true,
    autoInterval: 3000,
    onProgress: (p) => {
      progressRef.current.style.setProperty('--progress', p)
    }
  })

  const allGone = gone.size === items.length

  // when items are all gone, title is empty
  const titleTransition = useTransition(allGone || shuffling ? {} : slideItems[current], {
    from: {
      position: 'absolute',
      opacity: 0,
      transform: 'translateY(-40px)'
    },
    enter: {
      opacity: 1,
      transform: 'translateY(0)',
      config: config.gentle
    },
    leave: {
      opacity: 0,
      transform: 'translateY(40px)',
      config: config.stiff
    }
  })

  const bind = useDrag(({ args: [index], down, movement: [mx], velocity, first, last }) => {
    if (first) {
      pause()
    }
    const trigger = velocity > 0.2 || Math.abs(mx) > 100
    const dir = mx < 0 ? -1 : 1
    if (!down && trigger) {
      // add to gone here must be executed before next, because next will trigger the animation again in our onNext callback
      // apparently we don't want that happen because we execute fly animation below manually triggered by dragging
      // so add to gone here and our onNext callback will skip its animation
      addGone(index);
      next()
    }
    if (last) {
      play()
    }
    set((i) => {
      // only fly gone items
      if (index !== i) return
      const isGone = gone.has(index)
      const x = isGone ? (200 + window.innerWidth) * dir : down ? mx : 0
      const rot = mx / 100 + (isGone ? dir * 10 * velocity : 0)
      const scale = down ? 1.1 : 1
      return { x, rot, scale, delay: undefined, config: { friction: 50, tension: down ? 800 : isGone ? 200 : 500 } }
    })
  })

  const shuffleItems = () => {
    setShuffling(true)
    reset()
    pause()
    set((i) => {
      return {
        to: gone.has(i) ? { x: undefined } : { ...from(i) },
        delay: i < current ? 0 : (i - current) * 50,
        config: {
          friction: 50,
          tension: 300
        }
      }
    })
      .then(() => {
        // clear gone here to apply new background color after shuffling
        clearGone();
        setSlideItems(shuffle(slideItems))
        // keep set shuffling false here to make it sync with items re-entering, 500 is a magic number
        // if move it to the next promise chain, it will not execute before the re-entering animation fully complete
        delay(() => setShuffling(false), 500)
        return set((i) => ({ to: to(i), delay: i * 50 + 400, config: { friction: 50, tension: 300 } }))
      })
      .then(() => {
        play()
      })
  }

  // use last active item bg as section background
  const backgroundColor = allGone ? slideItems[items.length - 1].background : slideItems[gone.size].background
  return (
    <div className="section" style={{ backgroundColor }}>
      <div className="card-wrapper">
        {props.map(({ x, y, rot, scale }, i) => (
          <animated.div className="card" key={items[i].id} style={{ x, y, zIndex: slideItems.length - i }}>
            <animated.div
              className="card-inner"
              {...bind(i)}
              style={{ transform: interpolate([rot, scale], trans), background: slideItems[i].background }}>
              {slideItems[i].content}
            </animated.div>
          </animated.div>
        ))}
      </div>
      <div className="slide-content">
        <div className="slide-header">
          {titleTransition((values, item) => (
            <animated.h2 className="slide-title" key={item.id || 'none'} style={values}>
              {item.title || ''}
            </animated.h2>
          ))}
        </div>
      </div>
      <div>
        <div className="progress-container">
          <div className="progress" ref={progressRef}></div>
        </div>
        <div>
          <button onClick={() => play()}>start</button>
          <button onClick={() => pause()}>pause</button>
          <button onClick={() => prev()} disabled={shuffling || current === 0}>
            prev
          </button>
          <button onClick={() => next()} disabled={shuffling || allGone}>
            next
          </button>
          <button onClick={() => shuffleItems()} disabled={shuffling}>
            shuffle
          </button>
        </div>
      </div>
    </div>
  )
}

const App = () => {
  return (
    <div className="main">
      <Slider />
    </div>
  )
}

render(<App />, document.getElementById('root'))
