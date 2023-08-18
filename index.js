const express=require('express')
const port=3001
const app=express()
const db=require('./database/database');
const cors=require('cors')


function conexionbd(){
    db.connect(e=>{
        if(e){
            console.error(`Error al conectar a la base de datos ${e.stack}`)
            return;
        }
        console.log(`Conexion a la base de datos exitosa`)
    })
}

app.use(express.json())
app.use(cors())

app.get('/',(req,res)=>{
    res.send("Servidor iniciado")
})

app.post('/insertar-usuario', (req, res) => {
    const { nombre, contra, correo, telefono, monto, direccion } = req.body;
  
    const query = `INSERT INTO usuario (nombre, contra, correo, telefono, monto, direccion) VALUES ('${nombre}', '${contra}', '${correo}', '${telefono}', ${parseFloat(monto)}, '${direccion}')`;
  
    db.query(query, (e, r) => {
      console.log(query);
      if (e) {
        console.log(`Error al insertar usuario ${e.message}`);
        res.status(500).json({ error: "Error al insertar usuario" });
        return;
      }
      console.log("Usuario insertado con éxito");
      res.status(200).json({ message: "Usuario insertado con éxito" });
    });
  });

  
  app.post('/usuario-valido', (req, res) => {
    const { nombre, contra } = req.body;
    
    const query = `SELECT * FROM usuario WHERE nombre = '${nombre}' AND contra = '${contra}'`;
  
    db.query(query,(e, r) => {
        console.log(query)
      if (e) {
        console.log(`Error al realizar la consulta ${e.message}`);
        res.status(500).json({ error: "Error al realizar la consulta" });
        return;
      }

      console.log(r.rowCount)
  
      if (r.rowCount === 1) {
        console.log("Usuario válido encontrado");
        res.status(200).json({ message: "Usuario válido encontrado" });
      } else {
        console.log("Usuario no válido");
        res.status(404).json({ message: "Usuario no válido" });
      }
    });
  });


  app.get('/datos-usuario/:nombre/:contra', (req, res) => {
    const { nombre, contra } = req.params;
    const query = `SELECT * FROM usuario WHERE nombre = '${nombre}' AND contra = '${contra}'`;
    
    db.query(query, (e, r) => {
      if (e) {
        console.log(`Error al realizar la consulta ${e.message}`);
        res.status(500).json({ error: "Error al realizar la consulta" });
        return;
      }
      
      console.log(r);
      if (r.rowCount === 1) {
        const usuario = r.rows; 
        res.status(200).json({ usuario});
      } else {
        res.status(404).json({ message: "Usuario no encontrado" });
      }
    });
  });


app.get('/obtener-autos',(req,res)=>{
  const query=`SELECT * FROM auto`;
  db.query(query,(e,r)=>{
    if(e){
      console.log(`Error al realizar la consulta ${e.message}`);
      res.status(500).json({error:"Error al realizar la consulta"});
      return;
    }else{
      const autos=r.rows
      res.status(200).json(autos);
    }


  })

})


app.put('/reservar-auto', async (req, res) => {
  const { nombrec, nombreu } = req.body;

  try {
    const query = `SELECT * FROM AUTO where nombre='${nombrec}' and disponible='true'`;

    const autoQueryResult = await db.query(query);
    const autoid = autoQueryResult.rows[0].id;
    const precioAuto = autoQueryResult.rows[0].precio;

    if (autoQueryResult.rowCount === 0) {
      return res.status(404).json({ message: "No se encontró el auto disponible" });
    }

    const updateQuery = `UPDATE AUTO SET disponible='false' WHERE nombre='${nombrec}'`;
    await db.query(updateQuery);

    const fechactual = new Date();
    const fechaten = new Date(fechactual);
    fechaten.setDate(fechactual.getDate() + 10);

    const usuarioQuery = `SELECT id from usuario where nombre='${nombreu}'`;
    const usuarioQueryResult = await db.query(usuarioQuery);
    const id_cliente = usuarioQueryResult.rows[0].id;
    const montoAnterior = usuarioQueryResult.rows[0].monto;

    if (montoAnterior < precioAuto) {
      console.log(montoAnterior,precioAuto);
      return res.status(400).json({ message: "Saldo insuficiente para reservar el auto" });
    }

    const newQuery = `
      INSERT INTO reserva(fecha_inicio, fecha_fin, id_cliente)
      VALUES($1, $2, $3)
      RETURNING id`; // Agregamos RETURNING para obtener el id recién insertado
    
    const reservaQueryResult = await db.query(newQuery, [fechactual, fechaten, id_cliente]);
    const id_reserva = reservaQueryResult.rows[0].id; // Obtenemos el id recién insertado de la reserva

    const insert = `
      INSERT INTO auto_reserva(id_auto, id_reserva)
      VALUES($1, $2)`;
    
    await db.query(insert, [autoid, id_reserva]);

    const nuevoMonto = montoAnterior - precioAuto;
    const actualizarMontoQuery = `UPDATE usuario SET monto=$1 WHERE id=$2`;
    await db.query(actualizarMontoQuery, [nuevoMonto, id_cliente]);

    return res.status(200).json({ message: "Auto reservado exitosamente" });

  } catch (error) {
    console.error(`Error en la operación: ${error}`);
    return res.status(500).json({ message: "Ocurrió un error en la operación" });
  }
});



app.get('/obtener-transa/:nombre', async (req, res) => {
  const nombreCliente = req.params.nombre;

  try {
    // Obtener el id del cliente por su nombre
    const idClienteQuery = `SELECT id FROM usuario WHERE nombre = $1`;
    const idClienteResult = await db.query(idClienteQuery, [nombreCliente]);

    if (idClienteResult.rowCount === 0) {
      return res.status(404).json({ message: "No se encontró el cliente" });
    }

    const idCliente = idClienteResult.rows[0].id;

    // Obtener las transacciones relacionadas con el cliente
    const query = `
      SELECT r.*, a.* 
      FROM reserva r
      INNER JOIN auto_reserva ar ON r.id = ar.id_reserva
      INNER JOIN auto a ON ar.id_auto = a.id
      WHERE r.id_cliente = $1`;

    const result = await db.query(query, [idCliente]);

    return res.status(200).json(result.rows);

  } catch (error) {
    console.error(`Error en la operación: ${error}`);
    return res.status(500).json({ message: "Ocurrió un error en la operación" });
  }
});



app.put('/actualizar-perfil', async (req, res) => {
  const { nombre, contra, correo, telefono, monto, direccion } = req.body;

  try {
    const idQuery = 'SELECT id FROM usuario WHERE nombre = $1';
    const idResult = await db.query(idQuery, [nombre]);

    if (idResult.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const idUsuario = idResult.rows[0].id;


    const updateQuery = `
      UPDATE usuario
      SET contra = $1, correo = $2, telefono = $3, monto = $4, direccion = $5
      WHERE id = $6`;

    await db.query(updateQuery, [contra, correo, telefono, monto, direccion, idUsuario]);

    return res.status(200).json({ message: "Perfil actualizado exitosamente" });

  } catch (error) {
    console.error(`Error en la operación: ${error}`);
    return res.status(500).json({ message: "Ocurrió un error en la operación" });
  }
});






  

app.listen(port,()=>{
    console.log(`server is running on ${port}`)
    conexionbd()
})