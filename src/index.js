!(function(){

    // Simple JavaScript Templating
    // John Resig - http://ejohn.org/ - MIT Licensed
    var Template = (function(){
        var cache = {};

        return function tmpl(str, data){
            // Figure out if we're getting a template, or if we need to
            // load the template - and be sure to cache the result.
            var fn = !/\W/.test(str) ?
                cache[str] = cache[str] ||
                    tmpl(document.getElementById(str).innerHTML) :

                // Generate a reusable function that will serve as a template
                // generator (and which will be cached).
                new Function("obj",
                    "var p=[],print=function(){p.push.apply(p,arguments);};" +

                        // Introduce the data as local variables using with(){}
                        "with(obj){p.push('" +

                        // Convert the template into pure JavaScript
                        str
                            .replace(/[\r\t\n]/g, " ")
                            .split("<%").join("\t")
                            .replace(/((^|%>)[^\t]*)'/g, "$1\r")
                            .replace(/\t=(.*?)%>/g, "',$1,'")
                            .split("\t").join("');")
                            .split("%>").join("p.push('")
                            .split("\r").join("\\'")
                        + "');}return p.join('');");

            // Provide some basic currying to the user
            return data ? fn( data ) : fn;
        };
    })();

    /**
     * 文档相关的HTML模板
     */
    var HTML_TPLS = {
        doc: '\
            <div class="json-schema-doc">\
            <%=content%>\
            </div>\
        ',

        schemaBlock: '\
            <div class="schema-block schema-block-{type}">\
                <div class="summary">\
                <span class="name"><%=name%></span>\
                <span class="type"><%=type%></span>\
                <span class="desc"><%=(description && description.substring(0, 20))%><%=( description && description.length > 20 ? "..." : "")%></span>\
            </div>\
            <div class="detail">\
                <% if( description && description.length > 20 ){ %>\
                <div class="description">\
                    <%=description%>\
                </div>\
                <% } %>\
                <% if( constraint ){ %>\
                <ul class="constraint">\
                    <%=constraint%>\
                </ul>\
                <% } %>\
                <% if(children){ %>\
                <ul class="children">\
                    <%=children%>\
                </ul>\
                <% } %>\
            </div>',
        constraint: '\
            <% if( list ) for( var item, i = 0; i < list.length; i++){ item = list[ i ]; %>\
            <li>\
                <div class="field"><%=item.field%></div>\
                <div class="value"><%=item.value%></div>\
            </li>\
            <% } %>',
        children: '\
            <% if( list ) for( var item, i = 0; i < list.length; i++){ item = list[ i ];%>\
            <li>\
                <%=item%>\
            </li>\
            <% } %>'
    };

    /**
     *
     * @param {Object} schema
     * @param {Object} [options]
     * @param {Object} options.refs
     */
    var Generator = function( schema, options ){
        options = options || {};
        // 默认以 title 作为name，没有就只有描述
        return Template( HTML_TPLS.doc, { content: Generator._generator( schema.title, schema, schema, options ) });
    };

    Generator._generator = function( name, schema, wholeScheme, options ){

        // 先检查是否有 $ref
        if( schema.$ref ){

            var ret = /^#\/definitions\/(.+)$/.exec( schema.$ref );
            if( ret && ret[1] && wholeScheme.definitions && wholeScheme.definitions[ ret[1] ]){
                schema = wholeScheme.definitions[ ret[1] ];
            }
            // 若在本地找不到（可能是网络请求或者写错了）
            else if( options.refs && options.refs[ schema.$ref ] ){
                // 查找配置中是否给定了
                schema = options.refs[ schema.$ref ];
            }
            else {
                schema = {
                    description: '具体格式参考：' + schema.$ref
                };
            }
        }

        var constraint = [];
        var index;
        var item;
        var cons = [];

        /**
         * 构建通用约束
         * enum
         * default
         * format
         * allOf
         * anyOf
         * oneOf
         * not
         */

        // todo 枚举暂时只支持数字和字符串
        if( schema.enum ){
            constraint.push( { field: '枚举值', value: schema.enum.join( ', ' ) });
        }

        if( schema.default ){
            constraint.push( { field: '默认值', value: schema.default });
        }

        if( schema.format ){
            constraint.push( { field: '格式规范', value: schema.format });
        }

        if( schema.allOf && schema.allOf.length ){

            cons = [];

            for( index = 0; index < schema.allOf.length; index++ ){
                item = schema.allOf[ index ];
                cons.push( this._generator( '约束' + ( index + 1 ), item, wholeScheme, options ));
            }

            constraint.push( { field: '需要遵循所有约束', value: cons.join( ' ' ) });
        }

        if( schema.oneOf && schema.oneOf.length ){

            cons = [];

            for( index = 0; index < schema.oneOf.length; index++ ){
                item = schema.oneOf[ index ];
                cons.push( this._generator( '约束' + ( index + 1 ), item, wholeScheme, options ));
            }

            constraint.push( { field: '需要遵循其中的某个约束', value: cons.join( ' ' ) });
        }

        if( schema.anyOf && schema.anyOf.length ){

            cons = [];

            for( index = 0; index < schema.anyOf.length; index++ ){
                item = schema.anyOf[ index ];
                cons.push( this._generator( '约束' + ( index + 1 ), item, wholeScheme, options ));
            }

            constraint.push( { field: '需要遵循其中任意个约束', value: cons.join( ' ' ) });
        }

        if( schema.not ){
            constraint.push( { field: '不应该遵循该约束',
                value: cons.push( this._generator( '约束', schema.not, wholeScheme, options ))
            });
        }

        /**
         * 根据不同的类型，执行generator
         */
        var subGeneratorName = '_' + schema.type + 'Generator';

        console.log( subGeneratorName, schema );
        if( this[ subGeneratorName ] ){
            var subRet = this[ subGeneratorName ]( schema, wholeScheme, options );
            constraint = constraint.concat( subRet.constraint || [] );

            // 渲染子属性
            var childrenStr = Template( HTML_TPLS.children, { list: subRet.children } );
        }

        /**
         * 进行HTML构建
         */

            console.log( 'constraint', constraint );

        // 渲染约束
        var constraintStr = Template( HTML_TPLS.constraint, { list: constraint } );

        // 渲染用的数据
        var renderData = {
            name: name,
            type: schema.type,
            description: schema.description,
            constraint: constraintStr,
            children: childrenStr
        };

        // 进行block的渲染
        return Template( HTML_TPLS.schemaBlock, renderData );
    };

    /**
     * Object 对象genenrator
     * @param schema
     * @param wholeScheme
     * @param options
     * @private
     */
    Generator._objectGenerator = function( schema, wholeScheme, options ){

        var constraint = [];
        var children = [];
        var con = null;
        var key;
        var value;

        /**
         * 先查找约束
         */

        // required
        if( schema.required && schema.required.length ){
            constraint.push( { field: '必要属性', value:schema.required.join( ', ' ) } );
        }

        // dependences
        if( schema.dependences ){
            for( key in schema.dependences ){
                value = schema.dependences[ key ];

                if( value ){
                    con = {};
                    con.field = '若包含字段 “' + key + '” 则';

                    // 是否为数组，简单检查
                    if( value.length && value[0] ){
                        con.value = '必须同时包含属性: ' + value.join( ', ' );
                    }
                    // 若为对象
                    else {
                        con.value = this._generator( '还需要满足的约束', value, wholeScheme, options );
                    }

                    constraint.push( con );
                }
            }
        }

        // minProperties
        if( schema.minProperties >= 0 ){
            constraint.push( { field: '最少包含属性值数量', value: schema.minProperties } );
        }

        // maxProperties
        if( schema.maxProperties >= 0 ){
            constraint.push( { field: '最多包含属性值数量', value: schema.maxProperties } );
        }

        /**
         * 计算子属性
         */

        // properties
        if( schema.properties ){
            for( key in schema.properties ){
                children.push( this._generator( key, schema.properties[ key ], wholeScheme, options ) );
            }
        }

        // patternProperties
        if( schema.patternProperties ){
            for( key in schema.patternProperties ){
                children.push( this._generator( key, schema.patternProperties[ key ], wholeScheme, options ) );
            }
        }

        // additionalProperties
        if( schema.additionalProperties ){
            children.push( this._generator( '所有额外的属性', schema.additionalProperties, wholeScheme, options ) );
        }

        return {
            constraint: constraint,
            children: children
        };
    };

    /**
     * 数组类型 generator
     * @param schema
     * @param wholeScheme
     * @param options
     * @private
     */
    Generator._arrayGenerator = function( schema, wholeScheme, options ){

        var constraint = [];
        var children = [];
        var index;
        var item;

        /**
         * 先计算约束
         */
        if( schema.maxItems >= 0 || schema.minItems >= 0 ){

            constraint.push( { field: '列表长度',
                value: ( schema.maxItems >= 0 ? '<= ' + schema.maxItems : ' ' )
                + ( schema.minItems >= 0 ? '>= ' + schema.minItems : '' )
            });
        }

        if( schema.uniqueItems ){
            constraint.push( { field: '数组成员需要唯一' } );
        }

        /**
         * 计算 children
         */

        // items
        if( schema.items ){

            // 若为数组
            if( schema.items.length && schema.items[ 0 ] ){

                for( index = 0; index < schema.items.length; index++ ){
                    item = schema.items[ index ];
                    children.push( this._generator( '第' + ( index + 1 ) + '个成员', item, wholeScheme, options ) );
                }
            }
            else {
                children.push( this._generator( '所有成员', schema.items, wholeScheme, options ) );
            }
        }

        // additionalItems
        if( schema.additionalItems ){
            children.push( this._generator( '额外的成员', schema.additionalItems, wholeScheme, options ) );
        }

        return {
            constraint: constraint,
            children: children
        };
    };

    Generator._stringGenerator = function( schema, wholeScheme, options ){

        var constraint = [];

        /**
         * 计算约束
         */

        // pattern
        if( schema.pattern ){
            constraint.push( { field: '需要遵循正则', value: schema.pattern } );
        }

        // maxLength minLength
        if( schema.maxLength >= 0 || schema.minLength >= 0 ){

            constraint.push( { field: '字符串长度',
                value: ( schema.maxLength >= 0 ? '<= ' + schema.maxLength : ' ' )
                    + ( schema.minLength >= 0 ? '>= ' + schema.minLength : '' )
            });
        }

        return {
            constraint: constraint
        };
    };

    Generator._numberGenerator = function( schema, wholeScheme, options ){

        var constraint = [];

        /**
         * 计算约束
         */
        if( schema.multipleOf ){
            constraint.push( { field: '必须为' + schema.multipleOf + '的倍数' } );
        }

        if( schema.maximum !== undefined || schema.minimum !== undefined ){

            constraint.push( { field: '数值大小',
                value: ( schema.maximum !== undefined ? ( '<' + ( schema.exclusiveMaximum ? '=' : '' ) + ' ' + schema.maximum ) : ' ' )
                    + ( schema.minimum !== undefined ? ( '>' + ( schema.exclusiveMinimum ? '=' : '' ) + ' ' + schema.minimum ) : '' )
            });
        }

        return {
            constraint: constraint
        };
    };

    Generator._integerGenerator = function( schema, wholeScheme, options ){
        return this._numberGenerator( schema, options );
    };

    Generator._booleanGenerator = function( schema, wholeScheme, options ){
        return {};
    };

    Generator._nullGenerator = function( schema, wholeScheme, options ){
        return {};
    };



    /**
     * 判断当前JS环境
     */
    var hasDefine = typeof define === 'function';
    var hasExports = typeof module !== 'undefined' && module.exports;

    if( hasExports ){
        module.exports = Generator;
    }
    else if( hasDefine ){
        define(function(){
            return Generator;
        });
    }
    else {
        this.JsonSchemaDocGenerator = Generator;
    }

})();