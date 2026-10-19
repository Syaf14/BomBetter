// Canvas helpers shared by the modules' draw3d() functions (the Deaf player's 3D bomb faces).
export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

export function centeredText(ctx, text, x, y, size, color, weight = 800, family = 'system-ui, sans-serif') {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}
