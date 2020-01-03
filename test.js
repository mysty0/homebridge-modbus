'use strict';
let mconfig = require('./mconfig.json');
var ModBusClient = require('./modbus')

var mb = new ModBusClient(mconfig.floors[1])
mb.connect()
mb.updateLightState(() => console.log(mb.getStateArray()))
