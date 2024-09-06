const filaGrelha = [];   
const filaCortar = [];     
const filaBebida = [];   

let grelha = 4;  
let cortar = 7;
let bebida = 1;  

const workers = [
    { worker: new Worker('worker1.js'), ocupado: false },
    { worker: new Worker('worker2.js'), ocupado: false },
    { worker: new Worker('worker3.js'), ocupado: false },
    { worker: new Worker('worker4.js'), ocupado: false },
];

const tarefaFila = []; 


// função realizada pelo chat GPT.
function colocarTaskproWorker(tarefa, id, tempo) {
    return new Promise((resolve, reject) => {
        const workerDesempregado = workers.find(w => !w.ocupado);

        if (workerDesempregado) {
            workerDesempregado.ocupado = true;
            atualizarStatusDoWorker(workers.indexOf(workerDesempregado), `Executando ${tarefa} - Pedido ${id}`);
            workerDesempregado.worker.postMessage({ tempo, id });

            workerDesempregado.worker.onmessage = function(e) {
                if (e.data.cancelled) {
                    console.log(`Pedido ${id} foi cancelado durante a execução da tarefa ${tarefa}.`);
                    workerDesempregado.ocupado = false;
                    atualizarStatusDoWorker(workers.indexOf(workerDesempregado), 'Disponível');
                    resolve(); 
                    return; 
                }

                workerDesempregado.ocupado = false;
                atualizarStatusDoWorker(workers.indexOf(workerDesempregado), 'Disponível');
                resolve(e.data);
                processaFilaTask(); 
            };

            workerDesempregado.worker.onerror = function(e) {
                workerDesempregado.ocupado = false;
                atualizarStatusDoWorker(workers.indexOf(workerDesempregado), 'Erro');
                reject(`Erro no worker: ${e.message}`);
                processaFilaTask(); 
            };
        } else {
            tarefaFila.push({ tarefa, id, tempo, resolve, reject });
            console.log('Tarefa adicionada à fila de espera.');
        }
    });
}

function processaFilaTask() {
    if (tarefaFila.length > 0) {
        const { tarefa, id, tempo, resolve, reject } = tarefaFila.shift();
        colocarTaskproWorker(tarefa, id, tempo).then(resolve).catch(reject);
    }
}

let itensDoPedidoAtual = [];
const pedidos = [];
let id = 0;

function adicionarItem(nomeDoItem, tarefas, cortarTime = null, grelharTime = null, montarTime = null, prepararBebidaTime = null) {
    const itemPedido = {
        nomeDoItem,
        tarefas,
        times: { cortar: cortarTime, grelhar: grelharTime, montar: montarTime, prepararBebida: prepararBebidaTime },
        totalTime: (cortarTime || 0) + (grelharTime || 0) + (montarTime || 0) + (prepararBebidaTime || 0),
    };
    itensDoPedidoAtual.push(itemPedido);
    mostrarPedidoAtual();
}

function mostrarPedidoAtual() {
    const orderItemsDiv = document.getElementById('itensPedidos');
    orderItemsDiv.innerHTML = '';
    itensDoPedidoAtual.forEach((item) => {
        const itemDiv = document.createElement('div');
        itemDiv.innerHTML = `${item.nomeDoItem} - Tempo: ${item.totalTime} segundos`;
        orderItemsDiv.appendChild(itemDiv);
    });
}

function calcularTempoTotal(itensPedidos) {
    let totalTime = 0;

    let parallelTime = 0;
    let sequentialTime = 0;

    for (const item of itensPedidos) {
        let itemParallelTime = 0;

        if (item.times.cortar) {
            itemParallelTime = Math.max(itemParallelTime, item.times.cortar);
        }

        if (item.times.grelhar) {
            itemParallelTime = Math.max(itemParallelTime, item.times.grelhar);
        }

        sequentialTime += item.times.montar || 0;
        parallelTime += itemParallelTime;
    }

    totalTime = parallelTime + sequentialTime;
    return totalTime;
}

function colocarNoPedido() { // la ele, papo de colocar no pedido
    const isPriority = document.getElementById('prioridade').checked;
    const totalTime = calcularTempoTotal(itensDoPedidoAtual);
    
    const pedido = {
        id: id++ +1,
        itens: [...itensDoPedidoAtual], 
        totalTime,
        status: 'Na fila',
        startTime: null,
        endTime: null,
        cancelled: false,
        priority: isPriority,
    };

    pedidos.push(pedido);
    pedidos.sort((a, b) => b.priority - a.priority); 

    itensDoPedidoAtual = []; 
    mostrarPedidoAtual();
    mostrarPedido(pedido);
    processarPedido();
}

function mostrarPedido(pedido) {
    const orderQueue = document.getElementById('orderStatus');
    const orderDiv = document.createElement('div');
    orderDiv.id = `order-${pedido.id}`;
    orderDiv.innerHTML = `
        Pedido ${pedido.id} - Prioridade: ${pedido.priority ? 'Alta' : 'Normal'} - 
        <span>Status: ${pedido.status}</span> 
        <button onclick="cancelOrder(${pedido.id})">Cancelar</button>
    `;
    orderQueue.appendChild(orderDiv);

    const orderStatusDiv = document.getElementById('orderQueue');
    const orderStatusElement = document.createElement('div');
    orderStatusElement.innerHTML = `Pedido ${pedido.id} - Estimativa: ${pedido.totalTime} segundos`;
    orderStatusDiv.appendChild(orderStatusElement);
}


function atualizarStatusPedido(id, status) {
    const orderDiv = document.getElementById(`order-${id}`);
    const statusSpan = orderDiv.querySelector('span');
    statusSpan.textContent = `Status: ${status}`;
}


function processarPedido() {
    const pedido = pedidos.find(pedido => pedido.status === 'Na fila' && !pedido.cancelled);

    if (pedido) {
        pedido.startTime = pedido.startTime || Date.now();
        const itensPedidos = pedido.itens.filter(item => item.tarefas.length > 0);

        let promessaTask = [];

        itensPedidos.forEach(itemPedido => {
            itemPedido.tarefas.forEach(tarefa => {
                const tarefaPromise = colocarTaskproWorker(tarefa, pedido.id, itemPedido.times[tarefa] * 1000)
                    .then(() => {
                        if (pedido.cancelled) {
                            atualizarStatusPedido(pedido.id, 'Cancelado');
                        } else {
                            atualizarStatusPedido(pedido.id, `${tarefa} concluído`);
                            atualizarInterface(pedido.id, itemPedido.nomeDoItem, tarefa);
                        }

                        const indexTarefa = itemPedido.tarefas.indexOf(tarefa);
                        if (indexTarefa > -1) {
                            itemPedido.tarefas.splice(indexTarefa, 1);
                        }

                        if (itemPedido.tarefas.length === 0) {
                            return `Item ${itemPedido.nomeDoItem} concluído`;
                        }
                    })
                    .catch(error => {
                        console.error(`Erro no processamento do pedido ${pedido.id}:`, error);
                    });

                promessaTask.push(tarefaPromise);
            });
        });

        Promise.all(promessaTask)
            .then(() => {
                const itensCompletos = pedido.itens.every(item => item.tarefas.length === 0);
                if (itensCompletos && !pedido.cancelled) {
                    pedido.status = 'Concluído';
                    pedido.endTime = Date.now();
                    atualizarStatusPedido(pedido.id, 'Concluído');
                    finalizarPedidoInterface(pedido.id);
                } else if (pedido.cancelled) {
                    atualizarStatusPedido(pedido.id, 'Cancelado');
                    finalizarPedidoInterface(pedido.id);
                }
                processarPedido();
            })
            .catch(error => {
                console.error(`Erro no processamento do pedido ${pedido.id}:`, error);
            });
    }
}


function processWaitingOrders() {
    workers.forEach(worker => {
        if (!worker.busy) {
            if (filaGrelha.length > 0 && grelha > 0) {
                const proximoItem = filaGrelha.shift();
                grelha--;
                worker.busy = true;
                worker.worker.postMessage({ tarefa: 'grelhar', id: proximoItem.id, tempo: proximoItem.times['grelhar'] * 1000 });
                atualizarStatusDoWorker(workers.indexOf(worker), `grelhar - Pedido ${proximoItem.id}`);
            } else if (filaCortar.length > 0 && cortar > 0) {
                const proximoItem = filaCortar.shift();
                cortar--;
                worker.busy = true;
                worker.worker.postMessage({ tarefa: 'cortar', id: proximoItem.id, tempo: proximoItem.times['cortar'] * 1000 });
                atualizarStatusDoWorker(workers.indexOf(worker), `cortar - Pedido ${proximoItem.id}`);
            } else if (filaBebida.length > 0 && bebida > 0) {
                const proximoItem = filaBebida.shift();
                bebida--;
                worker.busy = true;
                worker.worker.postMessage({ tarefa: 'preparar bebida', id: proximoItem.id, tempo: proximoItem.times['preparar bebida'] * 1000 });
                atualizarStatusDoWorker(workers.indexOf(worker), `preparar bebida - Pedido ${proximoItem.id}`);
            }
        }
    });
}

function atualizarInterface(id, nomeDoItem, tarefa) {
    const elementoPedido = document.getElementById(`order-${id}`);
    const elementoItem = elementoPedido.querySelector(`.item-${nomeDoItem}`);
    
    if (elementoItem) {
        const milanB = elementoItem.querySelector(`.task-${tarefa}`);
        if (milanB) {
            milanB.classList.add('completed');
            milanB.innerText = `${tarefa} concluído`;
        }
    }
}

function finalizarPedidoInterface(id) {
    const elementoPedido = document.getElementById(`order-${id}`);
    if (elementoPedido) { 
        elementoPedido.classList.add('completed');
        const eStatus = elementoPedido.querySelector('.status');
        if (eStatus) {  
            eStatus.innerText = 'Pedido Concluído';
        }
        atualizarBotaoCancelar(id);
    } else {
        console.error(`Elemento do pedido ${id} não encontrado.`);
    }
}

function cancelOrder(id) {
    const pedido = pedidos.find(pedido => pedido.id === id);
    if (pedido && pedido.status !== 'Concluído' && pedido.status !== 'Cancelado') {
        pedido.cancelled = true;
        pedido.status = 'Cancelado';
        atualizarStatusPedido(id, 'Cancelado');

        tarefaFila.forEach((tarefa, index) => {
            if (tarefa.id === id) {
                tarefa.reject(`Pedido ${id} foi cancelado.`);
                tarefaFila.splice(index, 1); 
            }
        });

        removerItemFila(filaGrelha, id);
        removerItemFila(filaCortar, id);
        removerItemFila(filaBebida, id);

        workers.forEach(worker => {
            worker.worker.postMessage({ cancel: true });
        });

        console.log(`Pedido ${id} foi cancelado.`);
        atualizarBotaoCancelar(id);

        processaFilaTask();
    }
}

function injectSQLDaniel(){
    const hack = document.getElementById('hack');
    hack.innerHTML = `
        <img src="https://www.example.com/images/dinosaur.jpg" alt="">
    `;
}

function atualizarBotaoCancelar(id) {
    const orderDiv = document.getElementById(`order-${id}`);
    const cancelButton = orderDiv.querySelector('button');
    if (cancelButton) {
        cancelButton.remove();
    }
}

function removerItemFila(fila, id) {
    const index = fila.findIndex(item => item.id === id);
    if (index > -1) {
        fila.splice(index, 1); 
    }
    processarPedido();
}

function atualizarStatusDoWorker(indice, status) {
    const workerDiv = document.getElementById(`worker-${indice}`);
    if (workerDiv) {
        workerDiv.textContent = `Worker ${indice + 1}: ${status}`;
    } else {
        console.error(`Elemento de status do worker ${indice} não encontrado.`);
    }
}