const path = require('path')
const fs = require('fs')

const services = [
      {
        "name": "dendrite",
        "disabled": false,
        "description": "Dendrite Service",
        "route": (req) => {
          if (req.url.startsWith('/_matrix/') || req.url == '/_matrix' || req.url.startsWith('.well-known/matrix/')) {
            return process.env.CINNY_URL ?? 'http://localhost:8008'
          }
        },
    }
]

module.exports = services;