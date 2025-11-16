const path = require('path')
const fs = require('fs')

const services = [
      {
        "name": "cinny",
        "dirname": "chat",
        "disabled": true,
        "description": "Cinny Matrix Client for chatting",
        "route": (req) => {
          if (req.url.startsWith('/chat/') || req.url == '/chat') {
            return process.env.CINNY_URL ?? 'http://localhost:8181'
          }
        },
        disabledRoute: (req) => {
          if (req.url.startsWith('/chat/') || req.url == '/chat') {
            let r = req.url.split('?')[0]
            let file = path.join("/data/pages/", r)
            if(!fs.existsSync('../../'+file)){
              file = path.join("/data/pages/chat/index.html")
            }
            return "file://" + file
          }
        }
    }
]

module.exports = services;