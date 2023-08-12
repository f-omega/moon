// Do this as the first thing so that any code reading it knows the right env.
//process.env.BABEL_ENV = 'development';
//process.env.NODE_ENV = 'development';

import n3 from 'n3'
import fs from 'node:fs'
import path from 'node:path'

import { readGraphFromFile } from "./util.js"
import EditService from './EditService.js'
import ContentService from './ContentService.js'
import { RDF_TYPE, MOON_EDIT_SERVICE, MOON_CONTENT_SERVICE } from "./service.js"
import express from 'express'


import yargs from 'yargs';

// Tools like Cloud9 rely on this.

const args = yargs(process.argv)
      .scriptName('Moon')
      .usage('$0 [args]')
      .option('dataset', {
        alias: 'd',
        describe: 'Provide a path to a description of a SPARQL-enabled dataset using SPARQL Service Description and/or VoID'
      })
      .option('port', {
        alias: 'P',
        describe: 'Main port to provide editing services on'
      })
      .option('host', {
        alias: 'H',
        describe: 'Default host name to bind to'
      })
      .option('config', {
        alias: 'c',
        describe: 'Config file (in RDF format) to use'
      })
      .help()
      .argv

const DATASETS = args.dataset === undefined ? [] : (Array.isArray(args.dataset) ? args.dataset : [ args.dataset ]);
let DEFAULT_PORT = parseInt(process.env.PORT || "3000", 10) || 3000;
let HOST = process.env.HOST || '0.0.0.0';

let config = args.config === undefined ? [] : (Array.isArray(args.config) ? args.config : [ args.config ]);

console.log("GOT ARGS", args, config)
const services = []
const graph = new n3.Store()
Promise.all(config.map(async (c) => { await readGraphFromFile(graph, c); return c; })).then(async (p) => {
  console.log("RES", p)
  const abspath = path.resolve(p[0])
  console.log("RESOLVE", p, abspath)
  const baseurl = `file:///${abspath}`
  for ( const q of graph.getQuads(null, RDF_TYPE, MOON_EDIT_SERVICE, null) ) {
    console.log("GOT SERVICE", q)
    services.push(await EditService.fromServiceDescription(graph, q.subject, baseurl));
  }

  for ( const q of graph.getQuads(null, RDF_TYPE, MOON_CONTENT_SERVICE, null) ) {
    services.push(await ContentService.fromServiceDescription(graph, q.subject, baseurl))
  }
}).then(() =>{
  console.log(`Launching ${services.length} service(s)`)
  for ( const s of services ) {
    s.start()
  }
}).catch((e) => {
  console.error(e)
})

console.log("WAIT")
process.on('uncaughtExceptionMonitor', function (err, origin) {
  console.log("GOT error")
  console.error(err, origin);
  console.log("Exception", err, origin);
  console.log("Node NOT Exiting...");
});
