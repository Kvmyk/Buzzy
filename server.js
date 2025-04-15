const express = require('express');
const app = express();
const port = 3000;
const ipAddress = '2a01:4f9:2b:289c::130';

app.use(express.static('./'));

app.listen(port, ipAddress, () => {
  console.log(`Buzzy app running at http://[${ipAddress}]:${port}`);
});