## Modbus Lights

Simple homebridge plugin for controlling lights or other switchable accessories through modbus tcp. You can register multiple floors with lights and specify their register and amount

Config example:

```JSON
}  
  "platforms": [
    {
      "platform" : "ModbusLights",
      "name" : "modbus",
      "log": "./log/",
      "floors": [
        {
          "prefix": "Light ",
          "ip": "192.168.1.200",
          "register": 2,
          "count": 8
        },
        {
          "prefix": "Light 2-",
          "ip": "192.168.1.201",
          "register": 2,
          "count": 7
        }
      ]
    }
  ]
}
```

* log - where the light log with all turn off and turn on events will be saved
* prefix - prefix for light name for specific floor
* ip - modbus ip address
* register - modbus reigister index
* count - amount of the bits that are lights

