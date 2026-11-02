// PLAIN — no brand. Any color, your choice of font, optional corner text.
// This is the step 1 look, kept as a brand so every card goes through the same code.

registerBrand({
  id: "plain",
  name: "Plain",

  // Background choices. Text color is worked out automatically for these.
  themes: [
    { name: "Cream",    bg: "#F2E8D5" },
    { name: "Yellow",   bg: "#FFD166" },
    { name: "Orange",   bg: "#EF8354" },
    { name: "Pink",     bg: "#E5989B" },
    { name: "Teal",     bg: "#7FB7BE" },
    { name: "Blue",     bg: "#2A6F97" },
    { name: "Charcoal", bg: "#2D3142" },
    { name: "Forest",   bg: "#1B4332" },
  ],
  allowCustomColor: true,

  quoteFonts: [
    { name: "Serif", family: 'Georgia, "Times New Roman", serif' },
    { name: "Sans",  family: '"Segoe UI", Arial, sans-serif' },
  ],
  labelFont: { family: '"Segoe UI", Arial, sans-serif', weight: 600 },

  quoteMark: { opacity: 0.25 },   // big faint quote mark in the text color
});
