/**
 * Servicio para la gestión de productos y servicios.
 * Proporciona funciones para consultar la lista completa y buscar por identificadores específicos.
 * Utiliza el modelo ProdServ y gestiona errores con Boom para respuestas HTTP adecuadas.
 */

// Importa el modelo de productos/servicios desde Mongoose.
import ProdServ from '../models/ProdServ';
// Boom se usa para manejar errores HTTP de forma estructurada.
import boom from '@hapi/boom';
import Instrument from '../models/instrument.js';

// -----------------------------------------------------------------------------
// Obtiene la lista completa de productos y servicios.
// Utiliza ProdServ.find() para traer todos los documentos de la colección.
// Si ocurre un error, lo lanza como error interno HTTP usando Boom.
export const getProdServList = async () => { 
  let prodServList; 
  try { 
    prodServList = await ProdServ.find(); // Consulta todos los productos/servicios.
    return(prodServList); // Devuelve el arreglo de resultados.
  } catch (error) { 
    throw boom.internal(error); // Maneja errores como HTTP 500.
  } 
};

// -----------------------------------------------------------------------------
// Obtiene un producto/servicio por identificador y tipo de clave.
// Parámetros:
//   id: valor del identificador a buscar.
//   keyType: tipo de clave ('OK' para operativa, 'BK' para negocio).
// Utiliza findOne con el campo correspondiente según el tipo.
// Si ocurre un error, lo lanza como error interno HTTP usando Boom.
export const getProdServItem = async (id, keyType) => { 
  let prodServItem; 
  try { 
    if (keyType === 'OK') { 
      prodServItem = await ProdServ.findOne({ IdProdServOK: id }); // Busca por clave operativa.
    } else if (keyType === 'BK') { 
      prodServItem = await ProdServ.findOne({ IdProdServBK: id }); // Busca por clave de negocio.
    } 
    return(prodServItem); // Devuelve el documento encontrado o null.
  } catch (error) { 
    throw boom.internal(error); // Maneja errores como HTTP 500.
  } 
};

//-----------------------------------------------------------------------------
// Nota 7.1 postProdServ

//Commerce
// POST (ADD) Productos y/o Servicios.
// Recibe un objeto con la estructura del modelo ProdServ.
// Crea una nueva instancia del modelo y la guarda en la base de datos.
// Retorna el documento guardado o lanza un error si ocurre algún problema.

export const postProdServItem = async (paProdServItem) => {
	try {
		const newProdServItem = new ProdServ(paProdServItem);

		return await newProdServItem.save();//basicamente guarda el nuevo item en la base de datos y lo retorna 
    // para que pueda ser usado despues.
    /* EJEMPLO EN BASE AL MODELO DE PROD SERV
    {
      *"IdProdServOK": "PS1001",
      *"IdProdServBK": "BK1001",
      *"Name": "Producto de Ejemplo",
      *"Description": "Descripción del producto de ejemplo",
      *"Price": 29.99,
      *"Stock": 100,
      *"Category": "Electrónica"
  }

  !SON TODOS? LOS CAMPOS REQUERIDOS? NO, SOLO LOS QUE SON REQUERIDOS EN EL MODELO,
  !LOS DEMAS SON OPCIONALES Y PUEDEN SER AGREGADOS SEGUN LA NECESIDAD.
  !TAMBIEN SE PUEDEN AGREGAR CAMPOS ADICIONALES SI EL MODELO LO PERMITE.
  !ESTO ES SOLO UN EJEMPLO BASICO PARA ILUSTRAR EL USO DE LA FUNCION.
    */
	} catch (error) { //!aqui ya se maneja el erorr
  //el error en especifico es un error de validacion de mongoose directo de la libraria
  //por lo que no es necesario usar boom
		throw error;
	}
};

// Obtener todos los instrumentos
export const getInstrumentList = async () => {
  try {
    const instrumentList = await Instrument.find();
    return instrumentList;
  } catch (error) {
    throw boom.internal(error);
  }
};

// Obtener un instrumento por ID
export const getInstrumentById = async (id) => {
  try {
    const instrument = await Instrument.findById(id);
    return instrument;
  } catch (error) {
    throw boom.internal(error);
  }
};

// Crear un nuevo instrumento
export const postInstrumentItem = async (instrumentData) => {
  try {
    const newInstrument = new Instrument(instrumentData);
    return await newInstrument.save();
  } catch (error) {
    throw error;
  }
};