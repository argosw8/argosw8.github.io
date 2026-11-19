/* Configuration: section adapter for this portfolio's existing navigation. */
const HEX_DURATION = 520;
const HEX_CHARACTERS = '0123456789ABCDEF';
const HEX_CONTENT_SELECTOR = '.station.active .station-grid';
const HEX_STAGGER = 'top-to-bottom'; // Or 'left-to-right'.

(() => {
  'use strict';
  if (typeof travel !== 'function') return;
  const originalTravel = travel;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, cleanup = () => {}, generation = 0, restoring = false;

  function cancel() {
    cancelAnimationFrame(frame);
    cleanup();
    cleanup = () => {};
  }

  // Measure the real glyph cells. Canvas keeps randomized digits from reflowing text.
  function prepare() {
    const root = document.querySelector(HEX_CONTENT_SELECTOR);
    const pane = document.querySelector('.viewport');
    if (!root || !pane) return null;
    const bounds = pane.getBoundingClientRect();
    const scale = root.getBoundingClientRect().width / (root.offsetWidth || 1);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (/[a-z0-9]/i.test(n.data) && !n.parentElement.closest('svg,script,style,pre,code,input,textarea,select,[contenteditable],[hidden]')) nodes.push(n);
    }
    const glyphs = [], masks = [];
    const range = document.createRange();
    for (const node of nodes) {
      const style = getComputedStyle(node.parentElement);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const font = `${style.fontStyle} ${style.fontWeight} ${parseFloat(style.fontSize) * scale}px ${style.fontFamily}`;
      for (let i = 0; i < node.length; i++) {
        range.setStart(node, i); range.setEnd(node, i + 1);
        const r = range.getBoundingClientRect();
        if (!r.width || !r.height || !node.data[i].trim()) continue;
        glyphs.push({text:node.data[i], scramble:/[a-z0-9]/i.test(node.data[i]), x:r.left-bounds.left, y:r.top-bounds.top, w:r.width, h:r.height, font, color:style.color});
      }
      const mask = document.createElement('span');
      mask.className = 'hex-dissolve-mask';
      node.before(mask); mask.append(node); masks.push(mask);
    }
    const canvas = document.createElement('canvas');
    canvas.className = 'hex-dissolve-canvas'; canvas.setAttribute('aria-hidden', 'true');
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(bounds.width * ratio); canvas.height = Math.ceil(bounds.height * ratio);
    pane.append(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) { masks.forEach(m => m.replaceWith(...m.childNodes)); canvas.remove(); return null; }
    ctx.scale(ratio,ratio); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    glyphs.sort((a,b) => HEX_STAGGER === 'left-to-right' ? a.x-b.x || a.y-b.y : a.y-b.y || a.x-b.x);
    cleanup = () => { masks.forEach(m => m.replaceWith(...m.childNodes)); canvas.remove(); };
    return {glyphs, ctx, width:bounds.width, height:bounds.height};
  }

  function animate(duration, resolving, token, done) {
    const scene = prepare();
    if (!scene) { done(); return; }
    const start = performance.now(); let last = -1;
    function tick(now) {
      if (token !== generation) return;
      if (motion.matches) { cancel(); done(); return; }
      const progress = Math.min(1, (now-start)/duration);
      // Cap redraw to ~30fps; only this short-lived canvas is animated.
      const step = Math.floor((now-start)/33);
      if (step !== last) {
        last = step;
        scene.ctx.clearRect(0,0,scene.width,scene.height);
        scene.glyphs.forEach((g,i) => {
          const order = i / Math.max(1,scene.glyphs.length-1);
          const original = resolving ? progress >= .12 + order*.78 : progress < order*.65;
          const char = !g.scramble || original ? g.text : HEX_CHARACTERS[Math.floor(Math.random()*HEX_CHARACTERS.length)];
          scene.ctx.font = g.font; scene.ctx.fillStyle = g.color;
          scene.ctx.fillText(char, g.x+g.w/2, g.y+g.h/2, Math.max(1,g.w));
        });
      }
      if (progress < 1) frame = requestAnimationFrame(tick);
      else { cancel(); done(); }
    }
    frame = requestAnimationFrame(tick);
  }

  // Existing buttons, commands, wheel and keyboard all call this same function.
  travel = function(index, instant = false) {
    const target = Math.max(0,Math.min(ids.length-1,index));
    const token = ++generation;
    cancel();
    if (instant || motion.matches || target === active) {
      originalTravel(target,true); return;
    }
    lockUntil = Date.now() + HEX_DURATION + 100;
    const previousURL = location.href;
    const previousState = history.state;
    const fromHistory = restoring;
    animate(HEX_DURATION*.32, false, token, () => {
      if (token !== generation) return;
      const swap = () => {
        originalTravel(target,true); // Instant path bypasses the old analog canvas entirely.
        const nextURL = location.href;
        if (!fromHistory && nextURL !== previousURL) {
          history.replaceState(previousState,'',previousURL);
          history.pushState(null,'',nextURL);
        }
        lockUntil = Date.now() + HEX_DURATION*.68 + 100;
        animate(HEX_DURATION*.68,true,token,() => {});
      };
      if (document.startViewTransition) {
        try { document.startViewTransition(swap).finished.catch(() => {}); }
        catch { swap(); }
      } else swap();
    });
  };

  // Keep section navigation in browser history; no page scripts are re-executed.
  addEventListener('popstate', () => {
    const index = ids.indexOf(location.hash.slice(1));
    if (index >= 0) { restoring = true; try { travel(index); } finally { restoring = false; } }
  });
  addEventListener('resize', () => { ++generation; cancel(); });
  motion.addEventListener('change', () => { ++generation; cancel(); });
})();
