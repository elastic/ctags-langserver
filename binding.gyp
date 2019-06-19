{
  "targets": [
    {
      "target_name": "ctags",
      "sources": [ "src/ctags.cc" ],
      "conditions": [
        ["OS=='linux'", {
      	  "libraries": [ "<(module_root_dir)/thirdparty/libctags_linux.a", "<(module_root_dir)/thirdparty/libyaml_linux.a", "<(module_root_dir)/thirdparty/libxml2_linux.a, -liconv" ]
      	}],
      	["OS=='mac'", {
      	  "libraries": [ "<(module_root_dir)/thirdparty/libctags_mac.a", "-lxml2", "-lyaml", "-liconv" ]
      	}],
        ["OS=='win'", {
      	  # "libraries": [ "<(module_root_dir)/thirdparty/libctags_win.a", "<(module_root_dir)/thirdparty/libxml2.a", "<(module_root_dir)/thirdparty/libyaml.a" ],
      	  "libraries": [ "<(module_root_dir)/thirdparty/libctags_a.lib, <(module_root_dir)/libxml2_a.lib", "<(module_root_dir)/iconv_a.lib, -lyaml" ],
          'cflags': [
              '/SAFESEH:NO',
          ],
          'msvs_settings': {
            'VCCLCompilerTool': { 'ExceptionHandling': 1 },
            "VCLinkerTool": {
              "LinkIncremental": 1,
            }
          }
      	}]
      ]
    }
  ]
}