const path = require('path')
const fs = require('fs')

const services = [
      {
        "name": "dendrite",
        "disabled": false,
        "description": "Dendrite Service",
        "route": (req) => {}
    }
]

module.exports = services;