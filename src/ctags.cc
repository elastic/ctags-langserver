#include <node.h>
#include <string.h>

extern "C" {
   extern int ctags_cli_main (int argc, char **argv);
}

namespace ctags {

using v8::Exception;
using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::NewStringType;
using v8::Number;
using v8::String;
using v8::Object;
using v8::Value;

void Method(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    int length = args.Length();

    char** argv = new char*[length+1];
    for (int i = 0; i < length; i++) {
        String::Utf8Value value(args[i].As<String>());
        argv[i] = new char[100];
        strcpy(argv[i], *value);
    }
    argv[length] = NULL;
    args.GetReturnValue().Set(Number::New(isolate, ctags_cli_main(1, argv)));
}

void Initialize(Local<Object> exports) {
    NODE_SET_METHOD(exports, "run", Method);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)

}
