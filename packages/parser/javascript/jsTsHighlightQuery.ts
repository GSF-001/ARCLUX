// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Merged from official grammar repos (not written from scratch):
// tree-sitter/tree-sitter-javascript queries/highlights.scm (base tokens)
// + tree-sitter/tree-sitter-typescript queries/highlights.scm (TS-specific
// additions: type/interface/namespace keywords, type_identifier, etc).
// Works for both .js and .ts since TS's grammar is a superset of JS's.

export const JS_TS_HIGHLIGHTS_QUERY = `
(identifier) @variable
(property_identifier) @property

(function_expression name: (identifier) @function)
(function_declaration name: (identifier) @function)
(method_definition name: (property_identifier) @function.method)

(pair
  key: (property_identifier) @function.method
  value: [(function_expression) (arrow_function)])

(variable_declarator
  name: (identifier) @function
  value: [(function_expression) (arrow_function)])

(call_expression function: (identifier) @function)
(call_expression function: (member_expression property: (property_identifier) @function.method))

((identifier) @constructor (#match? @constructor "^[A-Z]"))
((identifier) @constant (#match? @constant "^[A-Z_][A-Z\\d_]+$"))
((identifier) @variable.builtin (#match? @variable.builtin "^(arguments|module|console|window|document)$"))
((identifier) @function.builtin (#eq? @function.builtin "require"))

(this) @variable.builtin
(super) @variable.builtin

[(true) (false) (null) (undefined)] @constant.builtin

(comment) @comment
[(string) (template_string)] @string
(regex) @string.special
(number) @number

(type_identifier) @type
(predefined_type) @type.builtin

[
  "abstract" "declare" "enum" "export" "implements" "interface" "keyof"
  "namespace" "private" "protected" "public" "readonly" "override" "satisfies"
  "as" "async" "await" "break" "case" "catch" "class" "const" "continue"
  "debugger" "default" "delete" "do" "else" "extends" "finally" "for"
  "from" "function" "get" "if" "import" "in" "instanceof" "let" "new"
  "of" "return" "set" "static" "switch" "target" "throw" "try" "type"
  "typeof" "var" "void" "while" "with" "yield"
] @keyword

[
  "-" "--" "-=" "+" "++" "+=" "*" "*=" "**" "**=" "/" "/=" "%" "%="
  "<" "<=" "<<" "<<=" "=" "==" "===" "!" "!=" "!==" "=>" ">" ">=" ">>"
  ">>=" ">>>" ">>>=" "~" "^" "&" "|" "^=" "&=" "|=" "&&" "||" "??"
  "&&=" "||=" "??="
] @operator
`;
