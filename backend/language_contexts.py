from database.schema import SupportedLanguage
from dotenv import load_dotenv
import os

load_dotenv()

temperature = float(os.getenv("CODE_COMPLETION_TEMPERATURE"))
top_p = float(os.getenv("TOP_P"))
max_tokens = int(os.getenv("CODE_COMPLETION_MENU_MAX_TOKENS"))


def get_language_contexts():
    return{
           
        SupportedLanguage.PYTHON: {
                        "patterns": ["def ", "class ", "import ", "from ", "if ", "for ", "while "],
                        "completion_prompt": (
                            "You are a Python code completion assistant. "
                            "Complete the following Python code snippet with syntactically correct and contextually appropriate code. "
                            "Provide only the completion code without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    },
                    SupportedLanguage.JAVASCRIPT: {
                        "patterns": ["function ", "const ", "let ", "var ", "if ", "for ", "class "],
                        "completion_prompt": (
                            "You are a JavaScript code completion assistant. "
                            "Complete the following JavaScript code snippet with modern, syntactically correct code. "
                            "Provide only the completion code without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    },
                    SupportedLanguage.TYPESCRIPT: {
                        "patterns": ["function ", "const ", "let ", "interface ", "type ", "class "],
                        "completion_prompt": (
                            "You are a TypeScript code completion assistant. "
                            "Complete the following TypeScript code with proper typing. "
                            "Provide only the completion code without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    },
                    SupportedLanguage.JAVA:{
                        "patterns": ["class ", "public ", "private ", "protected ", "void ", "import ", "package "],
                        "completion_prompt": (
                            "You are a Java code completion assistant. "
                            "Complete the following Java code with proper class and method structure. "
                            "Provide only the completion code without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    },
                    SupportedLanguage.CSHARP:{
                        "patterns": ["class ", "public ", "private ", "using ", "namespace ", "void "],
                        "completion_prompt": (
                            "You are a C# code completion assistant. "
                            "Complete the following C# code with correct syntax. "
                            "Provide only the completion code without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    },
                    SupportedLanguage.SQL:{
                        "patterns": ["SELECT ", "INSERT ", "UPDATE ", "DELETE ", "CREATE ", "ALTER ", "DROP "],
                        "completion_prompt": (
                            "You are an SQL code completion assistant. "
                            "Complete the following SQL query. "
                            "Provide only the SQL code without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    },
                    SupportedLanguage.HTML:{
                        "patterns": ["<html", "<head", "<body", "<div", "<span", "<script", "<style"],
                        "completion_prompt": (
                            "You are an HTML code completion assistant. "
                            "Complete the following HTML code. "
                            "Provide only the HTML without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    },
                    SupportedLanguage.CSS:{
                        "patterns": ["body", ".", "#", "@media", "color", "font", "background"],
                        "completion_prompt": (
                            "You are a CSS code completion assistant. "
                            "Complete the following CSS code. "
                            "Provide only the CSS without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    },
                    SupportedLanguage.GO:{
                        "patterns": ["package ", "import ", "func ", "var ", "const ", "if ", "for "],
                        "completion_prompt": (
                            "You are a Go code completion assistant. "
                            "Complete the following Go code. "
                            "Provide only the Go code without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    },
                    SupportedLanguage.RUST:{
                        "patterns": ["fn ", "let ", "struct ", "enum ", "impl ", "use ", "mod "],
                        "completion_prompt": (
                            "You are a Rust code completion assistant. "
                            "Complete the following Rust code. "
                            "Provide only the Rust code without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    },
                    SupportedLanguage.PHP:{
                        "patterns": ["<?php", "function ", "class ", "$", "if ", "for ", "while "],
                        "completion_prompt": (
                            "You are a PHP code completion assistant. "
                            "Complete the following PHP code. "
                            "Provide only the PHP code without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens}, 
                    },
                    SupportedLanguage.RUBY:{
                        "patterns": ["def ", "class ", "module ", "if ", "for ", "while ", "end"],
                        "completion_prompt": (
                            "You are a Ruby code completion assistant. "
                            "Complete the following Ruby code. "
                            "Provide only the Ruby code without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    },
                    SupportedLanguage.CPP:{
                        "patterns": ["#include", "int ", "class ", "namespace ", "if ", "for ", "while "],
                        "completion_prompt": (
                            "You are a C++ code completion assistant. "
                            "Complete the following C++ code. "
                            "Provide only the C++ code without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    },
                    SupportedLanguage.C:{
                        "patterns": ["#include", "int ", "void ", "char ", "if ", "for ", "while "],
                        "completion_prompt": (
                            "You are a C code completion assistant. "
                            "Complete the following C code. "
                            "Provide only the C code without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    },
                    SupportedLanguage.SWIFT:{
                        "patterns": ["func ", "class ", "struct ", "let ", "var ", "if ", "for "],
                        "completion_prompt": (
                            "You are a Swift code completion assistant. "
                            "Complete the following Swift code. "
                            "Provide only the Swift code without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    },
                    SupportedLanguage.DART:{
                        "patterns": ["import ", "class ", "void ", "final ", "var ", "if ", "for "],
                        "completion_prompt": (
                            "You are a Dart code completion assistant. "
                            "Complete the following Dart code. "
                            "Provide only the Dart code without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    },
                    SupportedLanguage.SCALA:{
                        "patterns": ["object ", "class ", "def ", "val ", "var ", "if ", "for "],
                        "completion_prompt": (
                            "You are a Scala code completion assistant. "
                            "Complete the following Scala code. "
                            "Provide only the Scala code without explanations:"
                        ),
                        "config": {"temperature": temperature, "top_p": top_p, "max_tokens": max_tokens},
                    }
    }