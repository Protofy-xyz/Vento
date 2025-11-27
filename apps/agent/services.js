const services = [
    {
        "name": "agent",
        "disabled": false,
        "description": "Vento Agent - System monitor and action executor",
        "route": (req) => {
            // Agent doesn't expose HTTP routes
        }
    }
]

module.exports = services;
