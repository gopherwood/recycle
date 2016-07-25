/* global console, window */
(function (window, Object, Array) {
    'use strict';
    
    var properties = {
            setUp: {
                value: null
            },
            recycle: {
                value: null
            }
        },
        recycleProd = function (cache, instance) {
            cache.push(instance);
        },
        recycleDebug = function (cache, instance) {
            if (instance.recycled) {
                console.warn('WHOA! I have already been recycled!', instance);
            } else {
                instance.recycled = true;
                cache.push(instance);
            }
        },
        recycleProp = {
            value: false,
            writable: true
        },
        setUpProd = function (cache) {
            var newObject = null;
            
            if (cache.length) {
                newObject = cache.pop();
            } else {
                newObject = Object.create(this.prototype);
            }

            this.apply(newObject, arguments);

            return newObject;
        },
        setUpArrayProd = function (cache) {
            var i = 0,
                arr = null;
            
            if (cache.length) {
                arr = cache.pop();
            } else {
                arr = [];
            }
            
            for (i = 0; i < arguments.length; i++) {
                arr.push(arguments[i]);
            }

            return arr;
        },
        setUpDebug = function (cache) {
            var newObject = null;
            
            if (cache.length) {
                newObject = cache.pop();
                newObject.recycled = false;
            } else {
                newObject = Object.create(this.prototype);
                Object.defineProperty(newObject, 'recycled', recycleProp);
            }

            this.apply(newObject, arguments);

            return newObject;
        },
        setUpArrayDebug = function (cache) {
            var i = 0,
                arr = null;
            
            if (cache.length) {
                arr = cache.pop();
                arr.recycled = false;
            } else {
                arr = [];
                Object.defineProperty(arr, 'recycled', recycleProp);
            }
            
            for (i = 1; i < arguments.length; i++) {
                arr.push(arguments[i]);
            }

            return arr;
        },
        caches = {},
        cacheIndex = 0;
    
    window.recycle = {
        add: function (ClassObject, debug, name, recycle) {
            var isArray = (ClassObject === Array),
                cache = [];
            
            if (name && caches[name]) {
                console.warn('Recycle cache for "' + name + '" already exists.');
            }

            caches[name || ('cache-' + (cacheIndex++))] = cache;
            
            if (debug) {
                properties.setUp.value = (isArray ? setUpArrayDebug : setUpDebug).bind(ClassObject, cache);
                properties.recycle.value = recycleDebug.bind(ClassObject, cache);
            } else {
                properties.setUp.value = (isArray ? setUpArrayProd : setUpProd).bind(ClassObject, cache);
                properties.recycle.value = recycleProd.bind(ClassObject, cache);
            }

            Object.defineProperties(ClassObject, properties);
            Object.defineProperty(ClassObject.prototype, 'recycle', {
                value: recycle || (isArray ? function (depth) {
                    var i = 0;
                    
                    if (depth > 1) {
                        i = this.length;
                        depth -= 1;
                        while (i--) {
                            this[i].recycle(depth);
                        }
                    }
                    this.length = 0;
                    ClassObject.recycle(this);
                } : function () {
                    ClassObject.recycle(this);
                })
            });
            
            return cache;
        },
        cache: caches
    };
}(window, Object, Array));