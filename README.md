Mockle Library
==============

Mockle is a node.js library that provides an easy way to spoof existing Bluetooth LE devices.

It relies on *Bleno.js* library (https://github.com/sandeepmistry/bleno).

How to install
--------------

Follow [*Bleno.js* install steps](https://github.com/sandeepmistry/bleno/blob/master/README.md).

```
$ git clone https://github.com/DigitalSecurity/mockle.git
$ cd mockle
$ sudo npm install -g
```

You're ready to go !

How to use Mockle
-----------------

Mockle provides two CLI tools:

* mockle-create: use this command-line tool to create a profile (.mock file) from an existing and available Bluetooth LE device
* mockle-spoof: use this command-line tool to basically spoof an existing device from a profile file

As an example, we have included an example spoofing an existing device.


