let cancelRequested = false;

onmessage = function(e) {
    if (e.data.cancel) {
        cancelarRequisicao = true;
        return;
    }

    const { tempo } = e.data;
    console.log(`Worker recebeu a tarefa. Tempo de execução: ${tempo}ms`);

    cancelarRequisicao = false;

    const intervalo = 50; 

    const verificaCancelamento = setInterval(() => {
        if (cancelarRequisicao) {
            clearInterval(verificaCancelamento);
            postMessage({ success: false, cancelled: true });
            console.log('Tarefa cancelada.');
            return;
        }
    }, intervalo);

    setTimeout(() => {
        clearInterval(verificaCancelamento);

        if (!cancelarRequisicao) {
            postMessage({ success: true });
            console.log(`Tarefa concluída após ${tempo}ms`);
        }
    }, tempo);
};
