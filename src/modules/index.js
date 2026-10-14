import wires from './wires.js';
import button from './button.js';
import keypad from './keypad.js';
import simon from './simon.js';
import memory from './memory.js';
import morse from './morse.js';

export const MODULES = { wires, button, keypad, simon, memory, morse };
export const TYPES = Object.keys(MODULES);
