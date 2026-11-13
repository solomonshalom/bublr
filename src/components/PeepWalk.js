/** @jsxImportSource @emotion/react */
import { useEffect, useRef } from 'react';
import { css } from '@emotion/react';
import gsap from 'gsap';

// 105 characters on one sheet, 15 across and 7 down.
const SPRITES = {
  src: '/images/characters.png',
  columns: 15,
  rows: 7,
};

// The crowd was drawn for a 350px-tall band. A shorter band scales the whole
// scene down (peeps, spacing, bounce, pace) instead of cropping it.
const DESIGN_HEIGHT = 350;
// How many peeps overlap across one peep-width of stage: all 105 on a 1440px
// screen at full size. Narrower stages get fewer, so phones see a crowd rather
// than a wall.
const DENSITY = 17.5;
const MIN_CROWD = 12;
// Walking pace in px/s at full size: a 1440px stage in 10 seconds.
const PACE = 168;
const BOUNCE_HEIGHT = 10;
const BOUNCE_DURATION = 0.25;
// Phones report 3x; drawing 9x the pixels buys nothing for line art.
const MAX_PIXEL_RATIO = 2;

const randomRange = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const takeRandom = (array) => array.splice((Math.random() * array.length) | 0, 1)[0];

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const PeepWalk = ({ height = '100%', width = '100%' }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const still = prefersReducedMotion();
    // skews random towards low values, which keeps most peeps low in the band
    // and hides that they have no legs
    const skewLow = gsap.parseEase('power2.in');

    const stage = { width: 0, height: 0, scale: 1, pixelRatio: 1 };
    const available = [];
    const crowd = [];

    let peepWidth = 0;
    let ready = false;
    let onScreen = true;

    // Where a peep is depends only on how far through its walk it is, so a
    // resize re-flows the crowd in place instead of restarting it.
    function drawPeep(peep) {
      const scale = stage.scale;
      const drawnWidth = peep.rect[2] * scale;
      const drawnHeight = peep.rect[3] * scale;

      // Flipped peeps are drawn leftwards from x, so both directions start and
      // end fully off stage.
      const fromX = peep.direction === 1 ? -drawnWidth : stage.width + drawnWidth;
      const toX = peep.direction === 1 ? stage.width : 0;
      const x = fromX + (toX - fromX) * peep.progress;

      // Never cut a head off at the top (leaves room for the bounce).
      const restY = Math.max(
        BOUNCE_HEIGHT * scale,
        stage.height - drawnHeight + (100 - 250 * peep.depth) * scale
      );
      const y = restY - BOUNCE_HEIGHT * scale * peep.bounce;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(peep.direction * scale, scale);
      ctx.drawImage(image, ...peep.rect, 0, 0, peep.rect[2], peep.rect[3]);
      ctx.restore();
    }

    function render() {
      if (!ready || !onScreen) return;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(stage.pixelRatio, stage.pixelRatio);
      crowd.forEach(drawPeep);
    }

    function crowdSize() {
      const fits = stage.width / (peepWidth * stage.scale);
      return clamp(Math.round(fits * DENSITY), MIN_CROWD, crowd.length + available.length);
    }

    function startWalk(peep) {
      const distance = stage.width + peep.rect[2] * stage.scale;
      const duration = distance / (PACE * stage.scale);

      const walk = gsap.timeline({
        onComplete: () => {
          crowd.splice(crowd.indexOf(peep), 1);
          available.push(peep);
          // after the stage shrinks, the extra peeps simply walk off
          if (crowd.length < crowdSize()) addPeep();
        },
      });
      walk.timeScale(randomRange(0.5, 1.5));
      walk.to(peep, { progress: 1, duration, ease: 'none' }, 0);
      walk.to(
        peep,
        {
          bounce: 1,
          duration: BOUNCE_DURATION,
          repeat: Math.max(1, Math.round(duration / BOUNCE_DURATION) - 1),
          yoyo: true,
        },
        0
      );

      return walk;
    }

    function addPeep() {
      const peep = takeRandom(available);
      peep.direction = Math.random() > 0.5 ? 1 : -1;
      peep.depth = skewLow(Math.random());
      peep.progress = 0;
      peep.bounce = 0;
      peep.walk = still ? null : startWalk(peep);

      crowd.push(peep);
      // peeps standing lower in the band are drawn last, in front
      crowd.sort((a, b) => b.depth - a.depth);

      return peep;
    }

    function fillCrowd() {
      const size = crowdSize();
      while (crowd.length < size && available.length) {
        // a random point along the walk spreads the peeps across the stage
        const peep = addPeep();
        if (peep.walk) peep.walk.progress(Math.random());
        else peep.progress = Math.random();
      }
    }

    function resize() {
      const { clientWidth, clientHeight } = canvas;
      if (!clientWidth || !clientHeight) return;

      stage.width = clientWidth;
      stage.height = clientHeight;
      // taller than designed: stay full size along the bottom, as before
      stage.scale = Math.min(1, clientHeight / DESIGN_HEIGHT);
      stage.pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      canvas.width = Math.round(clientWidth * stage.pixelRatio);
      canvas.height = Math.round(clientHeight * stage.pixelRatio);

      if (!ready) return;
      fillCrowd();
      render();
    }

    const image = new Image();
    image.onload = () => {
      const rectWidth = image.naturalWidth / SPRITES.columns;
      const rectHeight = image.naturalHeight / SPRITES.rows;
      peepWidth = rectWidth;

      for (let i = 0; i < SPRITES.columns * SPRITES.rows; i++) {
        available.push({
          rect: [
            (i % SPRITES.columns) * rectWidth,
            ((i / SPRITES.columns) | 0) * rectHeight,
            rectWidth,
            rectHeight,
          ],
          direction: 1,
          depth: 0,
          progress: 0,
          bounce: 0,
          walk: null,
        });
      }

      ready = true;
      resize();
      // reduced motion: the crowd stands still, drawn once per resize
      if (!still) gsap.ticker.add(render);
      canvas.style.opacity = 1;
    };
    image.src = SPRITES.src;

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    // No point drawing 60 frames a second into a canvas scrolled out of view.
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
    });
    visibilityObserver.observe(canvas);

    return () => {
      image.onload = null;
      gsap.ticker.remove(render);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      crowd.forEach((peep) => peep.walk && peep.walk.kill());
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      css={css`
        display: block;
        width: ${width};
        height: ${height};
        /* the sprite sheet arrives after the page; let the crowd fade in */
        opacity: 0;
        transition: opacity 600ms ease;
      `}
    />
  );
};

export default PeepWalk;
