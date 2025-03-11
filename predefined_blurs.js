// predefined_blurs.js
const PREDEFINED_BLURS = {
    "portal.clever.gy": [
      {
        "name": "Logo cliente actual",
        "selector": "span[data-slot='value']",
        "isPreset": true,
        "type": "blur"
      },
      {
        "name": "Logos clientes",
        "selector": "div[data-slot='content'][data-open='true']",
        "isPreset": true,
        "type": "blur"
      },
      {
        "name": "Datos tabla instalaciones",
        "selector": "table[aria-label='Instalaciones'] > tbody td:nth-child(2), table[aria-label='Instalaciones'] > tbody td:nth-child(3)",
        "isPreset": true,
        "type": "blur"
      },
      {
        "name": "Tabla de usuarios",
        "selector": "table[aria-label='Usuarios'] > tbody td:nth-child(2), table[aria-label='Usuarios'] > tbody td:nth-child(3), table[aria-label='Usuarios'] > tbody td:nth-child(4), table[aria-label='Usuarios'] > tbody td:nth-child(5)",
        "isPreset": true,
        "type": "blur"
      },
      {
        "name": "Tabla Comunidades Energéticas",
        "selector": "table[aria-label='Comunidades energéticas'] > tbody td:nth-child(1), table[aria-label='Comunidades energéticas'] > tbody td:nth-child(2)",
        "isPreset": true,
        "type": "blur"
      },
      {
        "name": "Listado de tickets",
        "selector": "table[aria-label='Listado de tickets'] > tbody td:nth-child(2), table[aria-label='Listado de tickets'] > tbody td:nth-child(3)",
        "isPreset": true,
        "type": "blur"
      },
      {
        "name": "Listado de inversores",
        "selector": "table[aria-label='Listado de inversores'] > tbody td:nth-child(1)",
        "isPreset": true,
        "type": "blur"
      },
      {
        "name": "Tabla de casas",
        "selector": "table[aria-label='Casas del usuario'] > tbody td:nth-child(1), table[aria-label='Casas del usuario'] > tbody td:nth-child(2)",
        "isPreset": true,
        "type": "blur"
      },
      {
        "name": "Listado de oportunidades de venta",
        "selector": "table[aria-label='Listado de oportunidades de venta'] > tbody td:nth-child(3), table[aria-label='Listado de oportunidades de venta'] > tbody td:nth-child(4), table[aria-label='Listado de oportunidades de venta'] > tbody td:nth-child(5)",
        "isPreset": true,
        "type": "blur"
      },
      {
          "name": "Datos del usuario",
          "selector": "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > main:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2), html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > main:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2), html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > main:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(3) > div:nth-of-type(2), html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > main:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(4) > div:nth-of-type(2), html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > main:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(5) > div:nth-of-type(2), html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > main:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(1) > h1:nth-of-type(1) > span:nth-of-type(1)",
          "isPreset": true,
          "type": "blur"
      }
    ],
    "www.xataka.com": [
      {
        "name": "Todos los anuncios",
        "selector": "#mastheadplus, .ad.ad-lat, .ad.ad-lat2, .delete-extension, [id*='div-gpt-lat'], div[id*='div-gpt-ad'], div.advertisement, div.adv, .publi-side, #container, #container_child, div[id='container'], div[id='container_child'], .ad.ad-cen, .ad.ad-cen2, div.ad-box, [id*='div-gpt-cen'], .ad.ad-top, [id*='div-gpt-top'], .ad.ad-cen2, [id*='div-gpt-cen2']",
        "isPreset": true,
        "type": "delete"
      }
    ]
  };