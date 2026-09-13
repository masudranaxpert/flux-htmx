// IIFE browser distribution entry point.
// Ensures `var Flux` evaluates directly to the single canonical API object.
// Publishes window.Flux and honours meta-tag autoStart (bootstrap contract).

import fluxApi, { bootstrapFlux } from './flux.js';

export default bootstrapFlux({ api: fluxApi });
