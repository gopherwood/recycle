/* global console */
export default (function (Object, Array) {
    var recycleProp = {
            value: false,
            writable: true
        },
        caches = {},
        cacheIndex = 0;
    
    return {
        add: function (ClassObject, debug, name, recycle) {
            var isArray = (ClassObject === Array),
                cache = [];
            
            if (name && caches[name]) {
                console.warn('Recycle cache for "' + name + '" already exists.');
            }

            caches[name || ('cache-' + (cacheIndex++))] = cache;
            
            Object.defineProperties(ClassObject, {
                setUp: {
                    value: (isArray ? (debug ? function () {
                        var i = 0,
                            arr = null;
                        
                        if (cache.length) {
                            arr = cache.pop();
                            arr.recycled = false;
                        } else {
                            arr = [];
                            Object.defineProperty(arr, 'recycled', recycleProp);
                        }
                        
                        for (i = 0; i < arguments.length; i++) {
                            arr.push(arguments[i]);
                        }

                        return arr;
                    } : function () {
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
                    }) : (debug ? function () {
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
                    } : function () {
                        var newObject = null;
                        
                        if (cache.length) {
                            newObject = cache.pop();
                        } else {
                            newObject = Object.create(this.prototype);
                        }

                        this.apply(newObject, arguments);

                        return newObject;
                    }))
                },
                recycle: {
                    value: (debug ? function (instance) {
                        if (instance.recycled) {
                            console.warn('WHOA! I have already been recycled!', instance);
                        } else {
                            instance.recycled = true;
                            cache.push(instance);
                        }
                    } : function (instance) {
                        cache.push(instance);
                    })
                }
            });
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
}(Object, Array));