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
	constructor(config) {
		this.config = config
		this.register = config.register
		this.socket = new net.Socket()
		this.client = new Modbus.client.TCP(this.socket)
		this.options = {
			'host' : config.ip,
			'port' : 502,
			'autoReconnect': true,
  			'reconnectTimeout': 5000,
		}

		this.connected = false
		this.light_state = 0
		this.busy = false
		this.busy_timeout = 0
	}

	dec2bin(dec) {
	    return (dec >>> 0).toString(2);
	}

	setLightBit(num, active) {
		if(active)
			this.light_state |= 1 << num
		else
			this.light_state &= ~(1 << num)
	}

	setBusy(val) {
		if(val) {
			this.busy_timeout = setTimeout(()=>{this.busy=false; console.log("busy timeout")}, 2000)
			this.busy = true
		} else {
			clearTimeout(this.busy_timeout)
			this.busy = false
		}
	}

	setLight(num, active) {
		active = !active

		var prev_light = this.light_state
		this.setLightBit(num, active)
		if(prev_light == this.light_state) return

		this.setBusy(true)
		retryOperation(function (){
			return this.client.writeSingleRegister(this.register, this.light_state)
		}.bind(this))
	    .then(function (resp) {
	    	console.log("light succesfully set")
	    	this.setBusy(false)
	    }.bind(this)).catch(function () {
	      console.error(arguments)
	      this.setBusy(false)
	    })
	}

	getStateArray() {
		return [...Array(this.config.count).keys()].map(i => (this.light_state >>> i) & 1)
		//return this.dec2bin(this.light_state).split('').slice(0, this.config.count)
	}

	updateLightState(callback) {
		retryOperation(function (){
			return this.client.readHoldingRegisters(this.register, 1)
		}.bind(this))
		.then(function (resp) {
			if(!this.busy)
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
			console.log(this.config.prefix+" connected to "+this.config.ip)
			this.connected = true
			this.updateLightState(callback)

		}.bind(this))
		this.socket.connect(this.options)
	}
}

module.exports = ModBusClient;