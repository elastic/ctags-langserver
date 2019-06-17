{
  "targets": [
    {
      "target_name": "ctags",
      "sources": [ "src/ctags.cc" ],
      "conditions": [
        ["OS=='linux'", {
      	  "libraries": [ "<(module_root_dir)/thirdparty/libctags_linux.a", "<(module_root_dir)/thirdparty/libyaml_linux.a", "<(module_root_dir)/thirdparty/libxml2_linux.a" ]
      	}],
      	["OS=='mac'", {
      	  "libraries": [ "<(module_root_dir)/thirdparty/libctags_mac.a", "-lxml2", "-lyaml", "-liconv" ]
      	}],
        ["OS=='win'", {
      	  "libraries": [ "<(module_root_dir)/thirdparty/libctags_win.a", "-lxml2", "-lyaml", "-liconv" ]
      	}]
      ]
    }
  ]
}