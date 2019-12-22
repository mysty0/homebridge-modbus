var modbus = require('./modbus')

var mb = new modbus()
mb.connect(function (){
	console.log('connected')
})