const ctags_runner = require('../build/Release/ctags');

process.on('message', async (message) => {
    const r = ctags_runner.run('ctags', '--fields=-anf+iKnS', '-f', `${message}/tags`, '-R', message);
    // send response to master process
    // @ts-ignore
    process.send(r);
});
