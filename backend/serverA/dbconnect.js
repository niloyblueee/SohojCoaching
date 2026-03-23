
const Pool = require("pg").Pool;
const pool = new Pool({
    user: "postgres",
    password: "NKCeddCdkqDFmJMTZeEXoSsBaebeUeVW",
    host: "hopper.proxy.rlwy.net",
    port: 58469,
    database: "railway",
});


module.exports = pool;
