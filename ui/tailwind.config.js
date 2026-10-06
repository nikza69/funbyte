const cfg = {
    darkMode: "class",
    theme: {
      extend: {
        "colors": {
          "inverse-primary": "#00687a",
          "on-primary-fixed": "#001f26",
          "tertiary": "#ffb690",
          "on-secondary": "#003824",
          "primary": "#4cd7f6",
          "surface-tint": "#4cd7f6",
          "on-tertiary": "#552100",
          "error": "#ffb4ab",
          "surface-container-lowest": "#0a0e16",
          "secondary-fixed-dim": "#4edea3",
          "surface-container-highest": "#31353e",
          "surface-container-low": "#181c24",
          "inverse-surface": "#dfe2ee",
          "tertiary-fixed": "#ffdbca",
          "surface-container": "#1c2028",
          "primary-fixed": "#acedff",
          "primary-container": "#06b6d4",
          "on-primary-container": "#00424f",
          "inverse-on-surface": "#2c3039",
          "on-tertiary-fixed": "#341100",
          "on-surface": "#dfe2ee",
          "on-tertiary-fixed-variant": "#783200",
          "secondary-fixed": "#6ffbbe",
          "on-secondary-fixed": "#002113",
          "on-secondary-container": "#00311f",
          "on-secondary-fixed-variant": "#005236",
          "outline-variant": "#3d494c",
          "on-background": "#dfe2ee",
          "on-primary": "#003640",
          "surface-dim": "#0f131c",
          "primary-fixed-dim": "#4cd7f6",
          "surface": "#0f131c",
          "on-tertiary-container": "#672a00",
          "background": "#0f131c",
          "on-error-container": "#ffdad6",
          "on-primary-fixed-variant": "#004e5c",
          "tertiary-fixed-dim": "#ffb690",
          "on-error": "#690005",
          "surface-bright": "#353942",
          "secondary-container": "#00a572",
          "error-container": "#93000a",
          "surface-variant": "#31353e",
          "on-surface-variant": "#bcc9cd",
          "outline": "#869397",
          "tertiary-container": "#ff853c",
          "secondary": "#4edea3",
          "surface-container-high": "#262a33"
        },
        "borderRadius": {
          "DEFAULT": "0.125rem",
          "lg": "0.25rem",
          "xl": "0.5rem",
          "full": "0.75rem"
        },
        "spacing": {
          "space-sm": "0.5rem",
          "gutter": "1rem",
          "margin-desktop": "2rem",
          "space-xl": "1.75rem",
          "space-xs": "0.25rem",
          "margin-tablet": "1.5rem",
          "space-lg": "1.25rem",
          "space-md": "0.75rem",
          "margin": "1rem",
          "gutter-desktop": "1.25rem"
        },
        "fontFamily": {
          "label-md": [
            "Inter"
          ],
          "body-lg": [
            "Inter"
          ],
          "metric-display-mobile": [
            "Inter"
          ],
          "headline-lg": [
            "Plus Jakarta Sans"
          ],
          "headline-xl": [
            "Plus Jakarta Sans"
          ],
          "body-md": [
            "Inter"
          ],
          "body-sm": [
            "Inter"
          ],
          "headline-xl-mobile": [
            "Plus Jakarta Sans"
          ],
          "display-lg": [
            "Plus Jakarta Sans"
          ],
          "display-lg-mobile": [
            "Plus Jakarta Sans"
          ],
          "label-xs-mono": [
            "Inter"
          ],
          "headline-sm": [
            "Plus Jakarta Sans"
          ],
          "metric-display": [
            "Inter"
          ]
        },
        "fontSize": {
          "label-md": [
            "12px",
            {
              "lineHeight": "16px",
              "letterSpacing": "0.02em",
              "fontWeight": "500"
            }
          ],
          "body-lg": [
            "15px",
            {
              "lineHeight": "22px",
              "fontWeight": "400"
            }
          ],
          "metric-display-mobile": [
            "24px",
            {
              "lineHeight": "30px",
              "letterSpacing": "-0.02em",
              "fontWeight": "700"
            }
          ],
          "headline-lg": [
            "20px",
            {
              "lineHeight": "28px",
              "letterSpacing": "-0.01em",
              "fontWeight": "600"
            }
          ],
          "headline-xl": [
            "28px",
            {
              "lineHeight": "36px",
              "letterSpacing": "-0.015em",
              "fontWeight": "600"
            }
          ],
          "body-md": [
            "13px",
            {
              "lineHeight": "18px",
              "fontWeight": "400"
            }
          ],
          "body-sm": [
            "12px",
            {
              "lineHeight": "16px",
              "fontWeight": "400"
            }
          ],
          "headline-xl-mobile": [
            "22px",
            {
              "lineHeight": "30px",
              "letterSpacing": "-0.015em",
              "fontWeight": "600"
            }
          ],
          "display-lg": [
            "36px",
            {
              "lineHeight": "44px",
              "letterSpacing": "-0.02em",
              "fontWeight": "700"
            }
          ],
          "display-lg-mobile": [
            "28px",
            {
              "lineHeight": "36px",
              "letterSpacing": "-0.02em",
              "fontWeight": "700"
            }
          ],
          "label-xs-mono": [
            "11px",
            {
              "lineHeight": "14px",
              "letterSpacing": "0.04em",
              "fontWeight": "600"
            }
          ],
          "headline-sm": [
            "16px",
            {
              "lineHeight": "24px",
              "letterSpacing": "-0.005em",
              "fontWeight": "600"
            }
          ],
          "metric-display": [
            "32px",
            {
              "lineHeight": "38px",
              "letterSpacing": "-0.02em",
              "fontWeight": "700"
            }
          ]
        }
      },
    },
  };
cfg.content = ['./index.html', './src/**/*.{vue,js}'];
module.exports = cfg;
