const Modbus = require('jsmodbus')
const net = require('net')

const wait = ms => new Promise(r => setTimeout(r, ms));

const retryOperation = (operation, delay=100, times=10) => new Promise((resolve, reject) => {
  return operation()
    .then(resolve)
    .catch((reason) => {
      if (times - 1 > 0) {
        return wait(delay)
          .then(retryOperation.bind(null, operation, delay, times - 1))
          .then(resolve)
          .catch(reject);
      }
      return reject(reason);
    });
});

class ModBusClient {

	constructor() {

		this.socket = new net.Socket()
		this.client = new Modbus.client.TCP(this.socket)
		this.options = {
			'host' : '192.168.1.201',
			'port' : 502,
			'autoReconnect': true,
  			'reconnectTimeout': 5000,
		}

		this.connected = false
		this.light_state = 0
	}

	dec2bin(dec) {
	    return (dec >>> 0).toString(2);
	}

	setBit(num, active) {
		if(active){
			this.light_state |= 1 << num
		} else {
			this.light_state &= ~(1 << num)
		}
	}

	setLight(num, active) {
		active = !active
		this.setBit(num, active)
		this.updateLightState(function (){
			var prev_state = this.light_state
			this.setBit(num, active)
			if(this.light_state == prev_state){
				return
			}
			retryOperation(function (){
				return this.client.writeMultipleRegisters(4, [this.light_state])
			}.bind(this))
		    .then(function (resp) {
		    	console.log("light succesfully set")
		    }).catch(function () {
		      console.error(arguments)
		    })
		}.bind(this))
	}

	getStateArray() {
		return this.dec2bin(this.light_state).split('')
	}

	updateLightState(callback) {
		retryOperation(function (){
			return this.client.readHoldingRegisters(4, 1)
		}.bind(this))
		.then(function (resp) {
			this.light_state = resp.response._body.valuesAsArray[0]
			if(callback)
				callback()
		}.bind(this))
		.catch(function () {
	      console.error(arguments)
	    })
	}

	connect(callback) {
		this.socket.on('connect', function () {
			console.log("connect")
			this.connected = true
			this.updateLightState(callback)

		}.bind(this))


		this.socket.connect(this.options)
	}
}

module.exports = ModBusClient;