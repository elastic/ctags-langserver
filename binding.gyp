{
  "targets": [
    {
      "target_name": "ctags",
      "sources": [ "src/ctags.cc" ],
      "conditions": [
        ["OS=='linux'", {
      	  "libraries": [ "<(module_root_dir)/thirdparty/libctags_linux.a", "-lxml2", "-lyaml" ]
      	  }],
      	["OS=='mac'", {
      	  "libraries": [ "<(module_root_dir)/thirdparty/libctags_mac.a", "-lxml2", "-lyaml", "-liconv" ]
      	}]
      ]
    }
  ]
}