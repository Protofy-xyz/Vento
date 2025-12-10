const path = require('path')

const services = [
      {
        "name": "adminpanel",
        "disabled": false,
        "description": "Admin panel UI to manage and interact with core services",
        "route": (req) => {
          if (req.url.startsWith('/workspace/') || req.url == '/workspace') {
            return process.env.ADMIN_PANEL_URL ?? 'http://localhost:3002'
          }
        },
        disabledRoute: (req) => {
          if (req.url.startsWith('/workspace/') || req.url == '/workspace') {
            let r = req.url.split('?')[0]
            const file = path.join("/data/pages/", r)
            return "file://" + file
          }
        }
    }
]

module.exports = services;