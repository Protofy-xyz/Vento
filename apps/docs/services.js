const path = require('path')

const services = [
    {
        "name": "docs",
        "disabled": true,
        "description": "Documentation site built with Docusaurus",
        "route": (req) => {
            if (req.url.startsWith('/docs/') || req.url == '/docs') {
                return process.env.DOCS_URL ?? 'http://localhost:3005'
            }
        },
        disabledRoute: (req) => {
            if (req.url.startsWith('/docs/') || req.url == '/docs') {
                let r = req.url.split('?')[0]
                const file = path.join("/data/pages/", r)
                return "file://" + file
            }
        }
    }
]

module.exports = services;

