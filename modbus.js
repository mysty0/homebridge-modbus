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
			'host' : config.ip, //'192.168.1.201',
			'port' : 502,
			'autoReconnect': true,
  			'reconnectTimeout': 5000,
		}

		this.connected = false
		this.light_state = 0
		this.queue = []
		this.busy = false
		this.busy_timeout = 0

		setInterval(this.update.bind(this), 100)
	}

	dec2bin(dec) {
	    return (dec >>> 0).toString(2);
	}

	setBit(value, num, active) {
		var val = value
		if(active){
			val |= 1 << num
		} else {
			val &= ~(1 << num)
		}
		return val
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

	update() {
		if(this.busy){
			//if(this.queue[this.queue-1] && this.queue[this.queue-1].name == "get"){
			//	this.queue.shift().arg()
			//xw}
			return
		}

		if(this.queue.length > 0) console.log(this.queue, this.light_state)
		var op = this.queue.shift()
		if(!op) return
		if(op.name == "set") {
			retryOperation(function (){
				return this.client.writeMultipleRegisters(this.register, [op.arg])
			}.bind(this))
		    .then(function (resp) {
		    	console.log("light succesfully set")
		    	this.setBusy(false)
		    }.bind(this)).catch(function () {
		      console.error(arguments)
		      this.setBusy(false)
		    })
		} 
		if (op.name == "get") {
			retryOperation(function (){
			return this.client.readHoldingRegisters(this.register, 1)
			}.bind(this))
			.then(function (resp) {
				if(!this.queue.find(e => e.name == "set"))
					this.light_state = resp.response._body.valuesAsArray[0]
				if(op.arg)
					op.arg()
				this.setBusy(false)
			}.bind(this))
			.catch(function () {
		      console.error(arguments)
		      this.setBusy(false)
		    })
		}
		this.setBusy(true)
	}

	addToQueue(name, arg) {
		this.queue.push({"name": name, "arg": arg})
	}

	setLight(num, active) {
		active = !active
		//this.setBit(num, active)
		//this.updateLightState(function (){
			console.log("setting light")
			//this.busy = true
			//var prev_state = this.light_state
			this.light_state = this.setBit(this.light_state, num, active)
			this.addToQueue("set", this.light_state)
			//if(this.light_state == prev_state){
			//	this.busy = false
			//	return
			//}
		//}.bind(this))
	}

	getStateArray() {
		return this.dec2bin(this.light_state).split('').slice(0, this.config.count)
	}

	updateLightState(callback) {
		this.addToQueue("get", callback)
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