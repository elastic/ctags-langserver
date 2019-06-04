{
  "targets": [
    {
      "target_name": "ctags",
      "sources": [ "src/ctags.cc" ],
      "libraries": [ "<(module_root_dir)/thirdparty/libctags.a", "/usr/lib/libxml2.2.dylib", "/usr/local/opt/libyaml/lib/libyaml-0.2.dylib", "/usr/lib/libiconv.2.dylib", "/usr/lib/libSystem.B.dylib" ]
    }
  ]
}