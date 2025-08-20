// // app/api/citas/recordatorios/route.ts - VERSIÓN CORREGIDA

// import { NextRequest, NextResponse } from 'next/server'
// import { PrismaClient } from "@prisma/client"
// import { auth } from '@clerk/nextjs/server'
// import nodemailer from 'nodemailer'
// import { whatsappManager, getConnectedWhatsAppService } from '../../../../lib/whatsapp-manager'

// const prisma = new PrismaClient()

// // POST - Enviar recordatorios automáticos
// export async function POST(request: NextRequest) {
//   try {
//     const authData = await auth()
//     const userId = authData?.userId
//     if (!userId) {
//       return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
//     }

//     console.log('🚀 [API] Iniciando proceso de recordatorios...')

//     // ✅ INICIALIZAR WHATSAPP AUTOMÁTICAMENTE
//     console.log('📱 [API] Verificando conexión WhatsApp...')
//     await whatsappManager.initialize()

//     // Verificar estado después de inicializar
//     if (!whatsappManager.isReady()) {
//       console.log('❌ [API] WhatsApp no está listo, intentando reconectar...')
//       const reconnected = await whatsappManager.ensureConnection()
      
//       if (!reconnected) {
//         return NextResponse.json({
//           success: false,
//           error: 'WhatsApp no está conectado. Por favor:',
//           instrucciones: [
//             '1. Detén el servidor Next.js (Ctrl+C)',
//             '2. Ejecuta: npx tsx scripts/init-whatsapp.ts',
//             '3. Escanea el código QR',
//             '4. Vuelve a iniciar el servidor Next.js'
//           ],
//           conectado: false
//         }, { status: 400 })
//       }
//     }

//     const whatsappService = whatsappManager.getService()
//     const user = await whatsappService.getConnectedUser()
//     console.log('✅ [API] WhatsApp conectado:', user?.name || 'Usuario desconocido')

//     // Calcular fecha de mañana
//     const ahora = new Date()
//     const manana = new Date()
//     manana.setDate(ahora.getDate() + 1)
    
//     const inicioDia = new Date(manana.getFullYear(), manana.getMonth(), manana.getDate(), 0, 0, 0)
//     const finDia = new Date(manana.getFullYear(), manana.getMonth(), manana.getDate(), 23, 59, 59)

//     console.log(`🔍 Buscando citas para: ${manana.toLocaleDateString('es-PE')}`)

//     // Buscar citas para mañana
//     const citasManana = await prisma.cita.findMany({
//       where: {
//         fechaHora: {
//           gte: inicioDia,
//           lte: finDia
//         },
//         estado: {
//           in: ['SOLICITADA', 'CONFIRMADA']
//         }
//       },
//       include: {
//         paciente: {
//           select: {
//             id: true,
//             nombres: true,
//             apellidos: true,
//             dni: true,
//             telefono: true,
//             email: true
//           }
//         }
//       }
//     })

//     console.log(`📋 Encontradas ${citasManana.length} citas para mañana`)

//     if (citasManana.length === 0) {
//       return NextResponse.json({
//         success: true,
//         message: 'No hay citas programadas para mañana',
//         enviados: 0,
//         totalCitas: 0,
//         detalles: [],
//         conectado: true
//       })
//     }

//     let recordatoriosEnviados = 0
//     const resultados = []

//     for (const cita of citasManana) {
//       try {
//         console.log(`\n🔄 Procesando: ${cita.paciente.nombres} ${cita.paciente.apellidos}`)

//         // Verificar recordatorio existente
//         const hoyInicio = new Date()
//         hoyInicio.setHours(0, 0, 0, 0)
//         const hoyFin = new Date()
//         hoyFin.setHours(23, 59, 59, 999)

//         const recordatorioExistente = await prisma.recordatorio.findFirst({
//           where: {
//             idCita: cita.id,
//             fechaEnvio: {
//               gte: hoyInicio,
//               lte: hoyFin
//             }
//           }
//         })

//         if (recordatorioExistente) {
//           console.log(`⚠️ Ya enviado hoy para ${cita.paciente.nombres}`)
//           resultados.push({
//             paciente: `${cita.paciente.nombres} ${cita.paciente.apellidos}`,
//             estado: 'YA_ENVIADO',
//             fecha: cita.fechaHora,
//             mensaje: 'Recordatorio ya enviado hoy'
//           })
//           continue
//         }

//         let recordatoriosEnviadosPaciente = 0
//         const telefonoFinal = cita.telefonoContacto || cita.paciente.telefono
//         const emailFinal = cita.emailContacto || cita.paciente.email

//         // 🚀 ENVIAR WHATSAPP
//         if (telefonoFinal) {
//           console.log(`📱 Enviando WhatsApp a: ${telefonoFinal}`)
          
//           const resultadoWhatsApp = await enviarWhatsAppBaileys(cita, telefonoFinal, whatsappService)
          
//           // Guardar en BD
//           await prisma.recordatorio.create({
//             data: {
//               idCita: cita.id,
//               fechaEnvio: new Date(),
//               medio: 'WHATSAPP',
//               estado: resultadoWhatsApp.success ? 'ENVIADO' : 'FALLIDO'
//             }
//           })

//           if (resultadoWhatsApp.success) {
//             recordatoriosEnviadosPaciente++
//             console.log(`✅ WhatsApp enviado`)
//           } else {
//             console.log(`❌ Error WhatsApp: ${resultadoWhatsApp.mensaje}`)
//           }

//           resultados.push({
//             paciente: `${cita.paciente.nombres} ${cita.paciente.apellidos}`,
//             estado: resultadoWhatsApp.success ? 'ENVIADO' : 'FALLIDO',
//             medio: 'WHATSAPP',
//             telefono: telefonoFinal,
//             fecha: cita.fechaHora,
//             motivo: cita.motivo,
//             mensaje: resultadoWhatsApp.mensaje,
//             messageId: resultadoWhatsApp.messageId
//           })

//           // Delay entre mensajes
//           console.log('⏳ Esperando 3 segundos...')
//           await new Promise(resolve => setTimeout(resolve, 3000))
//         }

//         // 📧 ENVIAR EMAIL
//         if (emailFinal) {
//           console.log(`📧 Enviando Email a: ${emailFinal}`)
          
//           const resultadoEmail = await enviarEmail(cita, emailFinal)
          
//           await prisma.recordatorio.create({
//             data: {
//               idCita: cita.id,
//               fechaEnvio: new Date(),
//               medio: 'EMAIL',
//               estado: resultadoEmail.success ? 'ENVIADO' : 'FALLIDO'
//             }
//           })

//           if (resultadoEmail.success) {
//             recordatoriosEnviadosPaciente++
//           }

//           resultados.push({
//             paciente: `${cita.paciente.nombres} ${cita.paciente.apellidos}`,
//             estado: resultadoEmail.success ? 'ENVIADO' : 'FALLIDO',
//             medio: 'EMAIL',
//             email: emailFinal,
//             fecha: cita.fechaHora,
//             motivo: cita.motivo,
//             mensaje: resultadoEmail.mensaje
//           })
//         }

//         if (!telefonoFinal && !emailFinal) {
//           resultados.push({
//             paciente: `${cita.paciente.nombres} ${cita.paciente.apellidos}`,
//             estado: 'SIN_CONTACTO',
//             fecha: cita.fechaHora,
//             mensaje: 'Sin teléfono ni email disponible'
//           })
//         }

//         recordatoriosEnviados += recordatoriosEnviadosPaciente

//       } catch (error) {
//         console.error(`❌ Error procesando cita ${cita.id}:`, error)
//         resultados.push({
//           paciente: `${cita.paciente.nombres} ${cita.paciente.apellidos}`,
//           estado: 'ERROR',
//           fecha: cita.fechaHora,
//           mensaje: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
//         })
//       }
//     }

//     console.log(`\n📊 RESUMEN: ${recordatoriosEnviados}/${citasManana.length} enviados`)

//     return NextResponse.json({
//       success: true,
//       message: `Proceso completado: ${recordatoriosEnviados} recordatorios enviados`,
//       enviados: recordatoriosEnviados,
//       totalCitas: citasManana.length,
//       detalles: resultados,
//       conectado: true,
//       usuario: user
//     })

//   } catch (error) {
//     console.error('❌ Error crítico:', error)
//     return NextResponse.json({
//       success: false,
//       error: 'Error interno del servidor',
//       detalle: error instanceof Error ? error.message : 'Error desconocido'
//     }, { status: 500 })
//   } finally {
//     await prisma.$disconnect()
//   }
// }

// // 🚀 FUNCIÓN WHATSAPP (sin cambios)
// async function enviarWhatsAppBaileys(cita: any, telefono: string, whatsappService: any) {
//   try {
//     const fechaCita = new Date(cita.fechaHora)
//     const fechaFormateada = fechaCita.toLocaleDateString('es-PE', {
//       weekday: 'long',
//       year: 'numeric',
//       month: 'long',
//       day: 'numeric'
//     })
//     const horaFormateada = fechaCita.toLocaleTimeString('es-PE', {
//       hour: '2-digit',
//       minute: '2-digit'
//     })

//     const mensaje = `🦷 *RECORDATORIO DENTAL - SONRISOFT*

// ¡Hola ${cita.paciente.nombres}! 👋

// Te recordamos que tienes una cita programada para *MAÑANA*:

// 📅 *Fecha:* ${fechaFormateada}
// 🕐 *Hora:* ${horaFormateada}
// 🏥 *Clínica:* SONRISOFT - Clínica Dental
// 📋 *Motivo:* ${cita.motivo || 'Consulta general'}

// *Recomendaciones importantes:*
// ✅ Llega 10 minutos antes
// ✅ Trae tu documento de identidad
// ✅ Si necesitas reprogramar, llámanos

// 📞 *Contacto:* (01) 234-5678
// 📍 *Dirección:* Av. Principal 123, Lima

// ¡Te esperamos! 😊

// _Mensaje automático del sistema SONRISOFT_`

//     let telefonoLimpio = telefono.toString().replace(/\D/g, '')
    
//     if (!telefonoLimpio.startsWith('51')) {
//       if (telefonoLimpio.startsWith('9')) {
//         telefonoLimpio = '51' + telefonoLimpio
//       } else {
//         telefonoLimpio = '51' + telefonoLimpio
//       }
//     }

//     if (!whatsappService.isReady()) {
//       return {
//         success: false,
//         mensaje: 'WhatsApp no está conectado'
//       }
//     }

//     // Verificar número
//     const tieneWhatsApp = await whatsappService.checkWhatsAppNumber(telefonoLimpio)
//     if (!tieneWhatsApp) {
//       return {
//         success: false,
//         mensaje: `El número ${telefono} no tiene WhatsApp registrado`
//       }
//     }

//     // Enviar mensaje
//     const result = await whatsappService.sendMessage({
//       to: telefonoLimpio,
//       message: mensaje
//     })

//     return {
//       success: result.success,
//       mensaje: result.success ? 'WhatsApp enviado correctamente' : `Error: ${result.error}`,
//       messageId: result.messageId
//     }

//   } catch (error) {
//     return {
//       success: false,
//       mensaje: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
//     }
//   }
// }

// // 📧 FUNCIÓN EMAIL (sin cambios)
// async function enviarEmail(cita: any, email: string) {
//   try {
//     const fechaCita = new Date(cita.fechaHora)
//     const fechaFormateada = fechaCita.toLocaleDateString('es-PE', {
//       weekday: 'long',
//       year: 'numeric',
//       month: 'long',
//       day: 'numeric'
//     })
//     const horaFormateada = fechaCita.toLocaleTimeString('es-PE', {
//       hour: '2-digit',
//       minute: '2-digit'
//     })

//     const transporter = nodemailer.createTransport({
//       service: 'gmail',
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//       }
//     })

//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: '🦷 Recordatorio de Cita - SONRISOFT Clínica Dental',
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2 style="color: #2563eb;">📅 Recordatorio de Cita</h2>
//           <p>¡Hola ${cita.paciente.nombres}!</p>
//           <p>Te recordamos tu cita para <strong>MAÑANA</strong>:</p>
//           <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
//             <p><strong>📅 Fecha:</strong> ${fechaFormateada}</p>
//             <p><strong>🕐 Hora:</strong> ${horaFormateada}</p>
//             <p><strong>🏥 Clínica:</strong> SONRISOFT</p>
//             <p><strong>📋 Motivo:</strong> ${cita.motivo || 'Consulta general'}</p>
//           </div>
//           <p>¡Te esperamos! 😊</p>
//         </div>
//       `
//     }

//     await transporter.sendMail(mailOptions)
    
//     return {
//       success: true,
//       mensaje: 'Email enviado correctamente'
//     }
    
//   } catch (error) {
//     return {
//       success: false,
//       mensaje: 'Error al enviar email'
//     }
//   }
// }

// // GET - Estado de WhatsApp
// export async function GET() {
//   try {
//     await whatsappManager.initialize()
//     const isReady = whatsappManager.isReady()
//     const service = whatsappManager.getService()
//     const user = isReady ? await service.getConnectedUser() : null
    
//     return NextResponse.json({
//       success: true,
//       connected: isReady,
//       user: user,
//       timestamp: new Date().toISOString()
//     })
//   } catch (error) {
//     return NextResponse.json({
//       success: false,
//       connected: false,
//       error: 'Error al obtener estado de WhatsApp'
//     })
//   }
// }

//------------------------------NUEVO--------------------------------SOLO EMAIL------------>
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from "@prisma/client"
import { auth } from '@clerk/nextjs/server'
import nodemailer from 'nodemailer'
// import { whatsappManager, getConnectedWhatsAppService } from '../../../../lib/whatsapp-manager' // COMENTADO: No se usará WhatsApp

const prisma = new PrismaClient()

// POST - Enviar recordatorios automáticos
export async function POST(request: NextRequest) {
  try {
    const authData = await auth()
    const userId = authData?.userId
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    console.log('🚀 [API] Iniciando proceso de recordatorios...')

    // ✅ INICIALIZAR WHATSAPP AUTOMÁTICAMENTE - COMENTADO: No se usará WhatsApp
    /*
    console.log('📱 [API] Verificando conexión WhatsApp...')
    await whatsappManager.initialize()

    // Verificar estado después de inicializar
    if (!whatsappManager.isReady()) {
      console.log('❌ [API] WhatsApp no está listo, intentando reconectar...')
      const reconnected = await whatsappManager.ensureConnection()
      
      if (!reconnected) {
        return NextResponse.json({
          success: false,
          error: 'WhatsApp no está conectado. Por favor:',
          instrucciones: [
            '1. Detén el servidor Next.js (Ctrl+C)',
            '2. Ejecuta: npx tsx scripts/init-whatsapp.ts',
            '3. Escanea el código QR',
            '4. Vuelve a iniciar el servidor Next.js'
          ],
          conectado: false
        }, { status: 400 })
      }
    }

    const whatsappService = whatsappManager.getService()
    const user = await whatsappService.getConnectedUser()
    console.log('✅ [API] WhatsApp conectado:', user?.name || 'Usuario desconocido')
    */

    // Calcular fecha de mañana
    const ahora = new Date()
    const manana = new Date()
    manana.setDate(ahora.getDate() + 1)
    
    const inicioDia = new Date(manana.getFullYear(), manana.getMonth(), manana.getDate(), 0, 0, 0)
    const finDia = new Date(manana.getFullYear(), manana.getMonth(), manana.getDate(), 23, 59, 59)

    console.log(`🔍 Buscando citas para: ${manana.toLocaleDateString('es-PE')}`)

    // Buscar citas para mañana
    const citasManana = await prisma.cita.findMany({
      where: {
        fechaHora: {
          gte: inicioDia,
          lte: finDia
        },
        estado: {
          in: ['SOLICITADA', 'CONFIRMADA']
        }
      },
      include: {
        paciente: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            dni: true,
            telefono: true,
            email: true
          }
        }
      }
    })

    console.log(`📋 Encontradas ${citasManana.length} citas para mañana`)

    if (citasManana.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay citas programadas para mañana',
        enviados: 0,
        totalCitas: 0,
        detalles: [],
        conectado: true // Cambiado a true ya que no dependemos de WhatsApp
      })
    }

    let recordatoriosEnviados = 0
    const resultados = []

    for (const cita of citasManana) {
      try {
        console.log(`\n🔄 Procesando: ${cita.paciente.nombres} ${cita.paciente.apellidos}`)

        // Verificar recordatorio existente
        const hoyInicio = new Date()
        hoyInicio.setHours(0, 0, 0, 0)
        const hoyFin = new Date()
        hoyFin.setHours(23, 59, 59, 999)

        const recordatorioExistente = await prisma.recordatorio.findFirst({
          where: {
            idCita: cita.id,
            fechaEnvio: {
              gte: hoyInicio,
              lte: hoyFin
            }
          }
        })

        if (recordatorioExistente) {
          console.log(`⚠️ Ya enviado hoy para ${cita.paciente.nombres}`)
          resultados.push({
            paciente: `${cita.paciente.nombres} ${cita.paciente.apellidos}`,
            estado: 'YA_ENVIADO',
            fecha: cita.fechaHora,
            mensaje: 'Recordatorio ya enviado hoy'
          })
          continue
        }

        let recordatoriosEnviadosPaciente = 0
        const telefonoFinal = cita.telefonoContacto || cita.paciente.telefono
        const emailFinal = cita.emailContacto || cita.paciente.email

        // 🚀 ENVIAR WHATSAPP - COMENTADO: No se usará WhatsApp
        /*
        if (telefonoFinal) {
          console.log(`📱 Enviando WhatsApp a: ${telefonoFinal}`)
          
          const resultadoWhatsApp = await enviarWhatsAppBaileys(cita, telefonoFinal, whatsappService)
          
          // Guardar en BD
          await prisma.recordatorio.create({
            data: {
              idCita: cita.id,
              fechaEnvio: new Date(),
              medio: 'WHATSAPP',
              estado: resultadoWhatsApp.success ? 'ENVIADO' : 'FALLIDO'
            }
          })

          if (resultadoWhatsApp.success) {
            recordatoriosEnviadosPaciente++
            console.log(`✅ WhatsApp enviado`)
          } else {
            console.log(`❌ Error WhatsApp: ${resultadoWhatsApp.mensaje}`)
          }

          resultados.push({
            paciente: `${cita.paciente.nombres} ${cita.paciente.apellidos}`,
            estado: resultadoWhatsApp.success ? 'ENVIADO' : 'FALLIDO',
            medio: 'WHATSAPP',
            telefono: telefonoFinal,
            fecha: cita.fechaHora,
            motivo: cita.motivo,
            mensaje: resultadoWhatsApp.mensaje,
            messageId: resultadoWhatsApp.messageId
          })

          // Delay entre mensajes
          console.log('⏳ Esperando 3 segundos...')
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
        */

        // 📧 ENVIAR EMAIL
        if (emailFinal) {
          console.log(`📧 Enviando Email a: ${emailFinal}`)
          
          const resultadoEmail = await enviarEmail(cita, emailFinal)
          
          await prisma.recordatorio.create({
            data: {
              idCita: cita.id,
              fechaEnvio: new Date(),
              medio: 'EMAIL',
              estado: resultadoEmail.success ? 'ENVIADO' : 'FALLIDO'
            }
          })

          if (resultadoEmail.success) {
            recordatoriosEnviadosPaciente++
          }

          resultados.push({
            paciente: `${cita.paciente.nombres} ${cita.paciente.apellidos}`,
            estado: resultadoEmail.success ? 'ENVIADO' : 'FALLIDO',
            medio: 'EMAIL',
            email: emailFinal,
            fecha: cita.fechaHora,
            motivo: cita.motivo,
            mensaje: resultadoEmail.mensaje
          })
        }

        if (!emailFinal) { // Modificado: Solo emailFinal, ya que WhatsApp está comentado
          resultados.push({
            paciente: `${cita.paciente.nombres} ${cita.paciente.apellidos}`,
            estado: 'SIN_CONTACTO',
            fecha: cita.fechaHora,
            mensaje: 'Sin email disponible' // Modificado: Mensaje específico para email
          })
        }

        recordatoriosEnviados += recordatoriosEnviadosPaciente

      } catch (error) {
        console.error(`❌ Error procesando cita ${cita.id}:`, error)
        resultados.push({
          paciente: `${cita.paciente.nombres} ${cita.paciente.apellidos}`,
          estado: 'ERROR',
          fecha: cita.fechaHora,
          mensaje: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
        })
      }
    }

    console.log(`\n📊 RESUMEN: ${recordatoriosEnviados}/${citasManana.length} enviados`)

    return NextResponse.json({
      success: true,
      message: `Proceso completado: ${recordatoriosEnviados} recordatorios enviados`,
      enviados: recordatoriosEnviados,
      totalCitas: citasManana.length,
      detalles: resultados,
      conectado: true // Cambiado a true ya que no dependemos de WhatsApp
    })

  } catch (error) {
    console.error('❌ Error crítico:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

// 🚀 FUNCIÓN WHATSAPP - COMENTADA COMPLETA
/*
async function enviarWhatsAppBaileys(cita: any, telefono: string, whatsappService: any) {
  try {
    const fechaCita = new Date(cita.fechaHora)
    const fechaFormateada = fechaCita.toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    const horaFormateada = fechaCita.toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit'
    })

    const mensaje = `🦷 *RECORDATORIO DENTAL - SONRISOFT*

¡Hola ${cita.paciente.nombres}! 👋

Te recordamos que tienes una cita programada para *MAÑANA*:

📅 *Fecha:* ${fechaFormateada}
🕐 *Hora:* ${horaFormateada}
🏥 *Clínica:* SONRISOFT - Clínica Dental
📋 *Motivo:* ${cita.motivo || 'Consulta general'}

*Recomendaciones importantes:*
✅ Llega 10 minutos antes
✅ Trae tu documento de identidad
✅ Si necesitas reprogramar, llámanos

📞 *Contacto:* (01) 234-5678
📍 *Dirección:* Av. Principal 123, Lima

¡Te esperamos! 😊

_Mensaje automático del sistema SONRISOFT_`

    let telefonoLimpio = telefono.toString().replace(/\D/g, '')
    
    if (!telefonoLimpio.startsWith('51')) {
      if (telefonoLimpio.startsWith('9')) {
        telefonoLimpio = '51' + telefonoLimpio
      } else {
        telefonoLimpio = '51' + telefonoLimpio
      }
    }

    if (!whatsappService.isReady()) {
      return {
        success: false,
        mensaje: 'WhatsApp no está conectado'
      }
    }

    // Verificar número
    const tieneWhatsApp = await whatsappService.checkWhatsAppNumber(telefonoLimpio)
    if (!tieneWhatsApp) {
      return {
        success: false,
        mensaje: `El número ${telefono} no tiene WhatsApp registrado`
      }
    }

    // Enviar mensaje
    const result = await whatsappService.sendMessage({
      to: telefonoLimpio,
      message: mensaje
    })

    return {
      success: result.success,
      mensaje: result.success ? 'WhatsApp enviado correctamente' : `Error: ${result.error}`,
      messageId: result.messageId
    }

  } catch (error) {
    return {
      success: false,
      mensaje: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}
*/

// 📧 FUNCIÓN EMAIL (sin cambios)
async function enviarEmail(cita: any, email: string) {
  try {
    const fechaCita = new Date(cita.fechaHora)
    const fechaFormateada = fechaCita.toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    const horaFormateada = fechaCita.toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit'
    })

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    })

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '🦷 Recordatorio de Cita - SONRISOFT Clínica Dental',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">📅 Recordatorio de Cita</h2>
          <p>¡Hola ${cita.paciente.nombres}!</p>
          <p>Te recordamos tu cita para <strong>MAÑANA</strong>:</p>
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
            <p><strong>📅 Fecha:</strong> ${fechaFormateada}</p>
            <p><strong>🕐 Hora:</strong> ${horaFormateada}</p>
            <p><strong>🏥 Clínica:</strong> SONRISOFT</p>
            <p><strong>📋 Motivo:</strong> ${cita.motivo || 'Consulta general'}</p>
          </div>
          <p>¡Te esperamos! 😊</p>
        </div>
      `
    }

    await transporter.sendMail(mailOptions)
    
    return {
      success: true,
      mensaje: 'Email enviado correctamente'
    }
    
  } catch (error) {
    return {
      success: false,
      mensaje: 'Error al enviar email'
    }
  }
}

// GET - Estado de WhatsApp - COMENTADO: No se usará WhatsApp
/*
export async function GET() {
  try {
    await whatsappManager.initialize()
    const isReady = whatsappManager.isReady()
    const service = whatsappManager.getService()
    const user = isReady ? await service.getConnectedUser() : null
    
    return NextResponse.json({
      success: true,
      connected: isReady,
      user: user,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      connected: false,
      error: 'Error al obtener estado de WhatsApp'
    })
  }
}
*/