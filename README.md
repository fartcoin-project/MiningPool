### Create Own Mining Pool with Node.js
-------
## Geek algo for GeekCash

Current version: v1.0.10, tested with Node.js v8.x.x

-------
### Node Open Mining Portal consists from 3 main modules:
* Main module - https://github.com/geekcash/node-open-mining-portal
* Stratum Pool - https://github.com/nasa8x/node-stratum-pool
* Node Multihashing libraries https://github.com/nasa8x/node-multi-hashing

Stratum Pool can be replaced with node-merged-pool (it's made in UNOMP)
Adding new algos threw Node Multihashing libraries.

-------
### Install
```
git clone https://github.com/geekcash/node-open-mining-portal.git pool
cd pool
npm install
node init.js
```
-------
### Requirements
* Node 8.x.x
* Coin daemon (GeekCash daemon)
* Redis Server

### Run in Docker

1) Correct configs appropriately to your environment in docker directory
2) ```cd docker```
3) ```docker build -t nomp .```
4) ```docker run -d --name nomp -v $(pwd)/config:/opt/config nomp ```

You will need to expose some ports to make it accessible from outside. You can achieve this by adding option -p HOST_PORT:CONTAINER_PORT in 4th step

You can see the logs of the server with ```docker logs -f nomp```, or jump into container with ```docker exec -it nomp```.

-------
### Hashing algorithms
#### Working
|   | Algorithm | Comment|
| ------------- | ------------- | ------------- |
| ✓ | __geek__ | Working with GeekCash.|
| ✓ | __lyra2z__ | Working with Zcoin. Infinex need testing|
| ✓ | __NeoScrypt__ | Onexcoin, working, need tests on other coins! |
| ? | __Groestl__ | tested only shares with AuroraCoin, blocks not tested |
| ? | __Scrypt__ | tested with AntiLiteCoin, 1CREDIT, ArgusCoin, WAYAWOLFCOIN and many others |
| ? | __SHA256__ | tested with VCOIN, don't use with BTC, no Segwit tested |
| ? | __X11__ | tested with BrainCoin, CannabisCoin, AdzCoin and many others |
| ? | __X16r__ | tested with RavenCoin |

-------
### Credits

* [nasa8x](//github.com/nasa8x/node-multi-hashing) - helped with geek algo
* [foxer666](//github.com/foxer666/node-stratum-pool) - Maintainer
* [devnulled](//github.com/devnull-ed) - Main maintainer, architecture
* [a2hill](//github.com/a2hill) - helped with X16r
* [Kris Klosterman / krisklosterman](https://github.com/krisklosterman) - Updated code for work wiht Node.JS >=8
* [Jerry Brady / mintyfresh68](https://github.com/bluecircle) - got coin-switching fully working and developed proxy-per-algo feature
* [Tony Dobbs](http://anthonydobbs.com) - designs for front-end and created the NOMP logo
* [LucasJones](//github.com/LucasJones) - got p2p block notify working and implemented additional hashing algos
* [vekexasia](//github.com/vekexasia) - co-developer & great tester
* [TheSeven](//github.com/TheSeven) - answering an absurd amount of my questions and being a very helpful gentleman
* [UdjinM6](//github.com/UdjinM6) - helped implement fee withdrawal in payment processing
* [Alex Petrov / sysmanalex](https://github.com/sysmanalex) - contributed the pure C block notify script
* [svirusxxx](//github.com/svirusxxx) - sponsored development of MPOS mode
* [icecube45](//github.com/icecube45) - helping out with the repo wiki
* [Fcases](//github.com/Fcases) - ordered me a pizza <3
* Those that contributed to [node-stratum-pool](//github.com/zone117x/node-stratum-pool#credits)

-------
### License
Released under the GNU General Public License v2
http://www.gnu.org/licenses/gpl-2.0.html
