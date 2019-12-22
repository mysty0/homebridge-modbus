const fs = require('fs');

function pack(val, size=4) {
	var res = ""
	for(var i = size-1; i >= 0; i--){
		res += String.fromCharCode((val >>> i*8) & 255)
	}
	return res
}

class LightLogger {
	constructor(path){
		this.path = path
		this.start_time = new Date().getTime()
	}

	saveChange(prefix, light_val) {
		var time = pack(Math.floor(new Date().getTime()/1000))
		var val = String.fromCharCode(light_val)

		fs.appendFile(`${this.path}${prefix}${this.start_time}.log`, time+val, "ascii", function (err) {
		  if (err) console.log(err)
		});
	}
} 

module.exports = LightLogger